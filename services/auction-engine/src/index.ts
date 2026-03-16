// ===========================================
// ORFLOW - Auction Engine
// Real-time auction system with WebSockets
// Inspired by Peatio exchange architecture
// ===========================================

import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AuctionRoom {
  auctionId: string;
  currentPrice: number;
  bidsCount: number;
  endsAt: Date;
  status: string;
  connectedUsers: Set<string>;
}

// In-memory auction state (backed by Supabase)
const auctionRooms = new Map<string, AuctionRoom>();

export function createAuctionServer(port: number = 3001) {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ===========================================
  // Socket.IO Events
  // ===========================================

  io.on('connection', async (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join auction room
    socket.on('join_auction', async ({ auctionId, userId }: { auctionId: string; userId: string }) => {
      socket.join(`auction:${auctionId}`);

      // Load or create room state
      if (!auctionRooms.has(auctionId)) {
        const { data: auction } = await supabase
          .from('auctions')
          .select('*')
          .eq('id', auctionId)
          .single();

        if (auction) {
          auctionRooms.set(auctionId, {
            auctionId,
            currentPrice: auction.current_price_eur,
            bidsCount: auction.bids_count,
            endsAt: new Date(auction.ends_at),
            status: auction.status,
            connectedUsers: new Set(),
          });
        }
      }

      const room = auctionRooms.get(auctionId);
      if (room) {
        room.connectedUsers.add(userId);

        // Send current state to the joining user
        socket.emit('auction_state', {
          auctionId,
          currentPrice: room.currentPrice,
          bidsCount: room.bidsCount,
          endsAt: room.endsAt,
          status: room.status,
          connectedCount: room.connectedUsers.size,
        });

        // Notify room of new viewer
        io.to(`auction:${auctionId}`).emit('viewer_count', {
          count: room.connectedUsers.size,
        });

        // Fetch recent bids
        const { data: recentBids } = await supabase
          .from('bids')
          .select('*, bidder:profiles(display_name, avatar_url)')
          .eq('auction_id', auctionId)
          .order('created_at', { ascending: false })
          .limit(10);

        socket.emit('recent_bids', recentBids || []);
      }
    });

    // Place a bid
    socket.on('place_bid', async ({
      auctionId,
      userId,
      amount,
      maxAutoBid,
    }: {
      auctionId: string;
      userId: string;
      amount: number;
      maxAutoBid?: number;
    }) => {
      try {
        // Call Supabase function to atomically process bid
        const { data, error } = await supabase
          .rpc('process_bid', {
            p_auction_id: auctionId,
            p_bidder_id: userId,
            p_amount: amount,
            p_max_auto_bid: maxAutoBid || null,
          });

        if (error || !data?.success) {
          socket.emit('bid_error', {
            message: data?.error || error?.message || 'Failed to place bid',
          });
          return;
        }

        // Update room state
        const room = auctionRooms.get(auctionId);
        if (room) {
          room.currentPrice = amount;
          room.bidsCount += 1;
        }

        // Fetch the new bid with bidder info
        const { data: newBid } = await supabase
          .from('bids')
          .select('*, bidder:profiles(display_name, avatar_url)')
          .eq('id', data.bid_id)
          .single();

        // Broadcast to all in auction room
        io.to(`auction:${auctionId}`).emit('new_bid', {
          type: 'NEW_BID',
          auction_id: auctionId,
          bid: newBid,
          new_price: amount,
          bids_count: room?.bidsCount || 0,
        });

        // Acknowledge to bidder
        socket.emit('bid_confirmed', {
          bid_id: data.bid_id,
          amount,
        });

        // Check for auto-bidding from other participants
        await processAutoBids(auctionId, amount, userId, io);

      } catch (err) {
        console.error('Bid processing error:', err);
        socket.emit('bid_error', { message: 'Internal server error' });
      }
    });

    // Buy now
    socket.on('buy_now', async ({ auctionId, userId }: { auctionId: string; userId: string }) => {
      const { data: auction } = await supabase
        .from('auctions')
        .select('buy_now_price_eur, status')
        .eq('id', auctionId)
        .single();

      if (!auction?.buy_now_price_eur || auction.status !== 'live') {
        socket.emit('buy_now_error', { message: 'Buy now not available' });
        return;
      }

      // Process as winning bid and end auction
      await supabase.rpc('process_bid', {
        p_auction_id: auctionId,
        p_bidder_id: userId,
        p_amount: auction.buy_now_price_eur,
      });

      await supabase
        .from('auctions')
        .update({ status: 'ended', winner_id: userId })
        .eq('id', auctionId);

      io.to(`auction:${auctionId}`).emit('auction_ended', {
        type: 'AUCTION_STATUS_CHANGE',
        auction_id: auctionId,
        status: 'ended',
        winner_id: userId,
        final_price: auction.buy_now_price_eur,
      });
    });

    // Leave auction
    socket.on('leave_auction', ({ auctionId, userId }: { auctionId: string; userId: string }) => {
      socket.leave(`auction:${auctionId}`);
      const room = auctionRooms.get(auctionId);
      if (room) {
        room.connectedUsers.delete(userId);
        io.to(`auction:${auctionId}`).emit('viewer_count', {
          count: room.connectedUsers.size,
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // ===========================================
  // Auction Timer Engine
  // Checks every 10 seconds for ended auctions
  // ===========================================

  setInterval(async () => {
    const now = new Date();

    // Find auctions that should go live
    const { data: toStart } = await supabase
      .from('auctions')
      .select('id')
      .eq('status', 'scheduled')
      .lte('starts_at', now.toISOString());

    for (const auction of (toStart || [])) {
      await supabase
        .from('auctions')
        .update({ status: 'live' })
        .eq('id', auction.id);

      io.to(`auction:${auction.id}`).emit('auction_started', {
        type: 'AUCTION_STATUS_CHANGE',
        auction_id: auction.id,
        status: 'live',
      });
    }

    // Find ended auctions
    const { data: toEnd } = await supabase
      .from('auctions')
      .select('id, winner_id, current_price_eur, bids_count')
      .eq('status', 'live')
      .lte('ends_at', now.toISOString());

    for (const auction of (toEnd || [])) {
      await supabase
        .from('auctions')
        .update({ status: 'ended' })
        .eq('id', auction.id);

      io.to(`auction:${auction.id}`).emit('auction_ended', {
        type: 'AUCTION_STATUS_CHANGE',
        auction_id: auction.id,
        status: 'ended',
        winner_id: auction.winner_id,
        final_price: auction.current_price_eur,
        bids_count: auction.bids_count,
      });

      // Create order if winner exists
      if (auction.winner_id) {
        await createAuctionOrder(auction.id);
      }

      // Clean up room
      auctionRooms.delete(auction.id);
    }
  }, 10000);

  httpServer.listen(port, () => {
    console.log(`OrFlow Auction Engine running on port ${port}`);
  });

  return { io, httpServer };
}

// ===========================================
// Auto-bidding Logic
// ===========================================

async function processAutoBids(
  auctionId: string,
  newPrice: number,
  lastBidderUserId: string,
  io: SocketIOServer
) {
  // Find users with auto-bid set above current price (excluding last bidder)
  const { data: autoBids } = await supabase
    .from('bids')
    .select('bidder_id, max_auto_bid_eur')
    .eq('auction_id', auctionId)
    .neq('bidder_id', lastBidderUserId)
    .gt('max_auto_bid_eur', newPrice)
    .order('max_auto_bid_eur', { ascending: false })
    .limit(1);

  if (!autoBids?.length) return;

  const topAutoBid = autoBids[0];
  const { data: auction } = await supabase
    .from('auctions')
    .select('bid_increment_eur, current_price_eur')
    .eq('id', auctionId)
    .single();

  if (!auction) return;

  const autoBidAmount = Math.min(
    topAutoBid.max_auto_bid_eur,
    newPrice + auction.bid_increment_eur
  );

  const { data: result } = await supabase.rpc('process_bid', {
    p_auction_id: auctionId,
    p_bidder_id: topAutoBid.bidder_id,
    p_amount: autoBidAmount,
  });

  if (result?.success) {
    const room = auctionRooms.get(auctionId);
    if (room) {
      room.currentPrice = autoBidAmount;
      room.bidsCount += 1;
    }

    io.to(`auction:${auctionId}`).emit('new_bid', {
      type: 'NEW_BID',
      auction_id: auctionId,
      bid: { bidder_id: topAutoBid.bidder_id, amount_eur: autoBidAmount, is_auto_bid: true },
      new_price: autoBidAmount,
      bids_count: room?.bidsCount || 0,
      is_auto_bid: true,
    });
  }
}

// ===========================================
// Order Creation on Auction End
// ===========================================

async function createAuctionOrder(auctionId: string) {
  const { data: auction } = await supabase
    .from('auctions')
    .select('*, listing:listings(*)')
    .eq('id', auctionId)
    .single();

  if (!auction?.winner_id) return;

  const amount = auction.current_price_eur;
  const platformFee = amount * 0.05; // 5% platform fee
  const sellerPayout = amount - platformFee;

  await supabase.from('orders').insert({
    listing_id: auction.listing_id,
    buyer_id: auction.winner_id,
    seller_id: auction.seller_id,
    auction_id: auctionId,
    amount_eur: amount,
    platform_fee_eur: platformFee,
    seller_payout_eur: sellerPayout,
    status: 'confirmed',
  });
}

// Start the server
if (require.main === module) {
  createAuctionServer(parseInt(process.env.AUCTION_PORT || '3001'));
}
