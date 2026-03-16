'use client';

import { useState, useEffect, useRef, use } from 'react';
import { io, Socket } from 'socket.io-client';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { formatEur } from '@/lib/gold';
import { Zap, Users, Clock, TrendingUp, ChevronUp } from 'lucide-react';
import type { Auction, Bid, Profile } from '@orflow/types';

function useCountdown(endsAt: string) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, total: 0 });

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setTimeLeft({
        total: diff,
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  return timeLeft;
}

export default function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [auction, setAuction] = useState<Auction & { listing: { images: string[]; weight_grams: number; gold_purity: string } } | null>(null);
  const [bids, setBids] = useState<(Bid & { bidder: Partial<Profile> })[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [autoBidMax, setAutoBidMax] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const timeLeft = useCountdown(auction?.ends_at || new Date().toISOString());

  useEffect(() => {
    const supabase = createClient();

    // Fetch initial data
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser(profile);
      }

      const { data: auctionData } = await supabase
        .from('auctions')
        .select('*, listing:listings(*), seller:profiles(display_name, is_verified)')
        .eq('id', id)
        .single();
      setAuction(auctionData);

      const { data: bidsData } = await supabase
        .from('bids')
        .select('*, bidder:profiles(display_name, avatar_url)')
        .eq('auction_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      setBids(bidsData || []);
    }

    loadData();

    // Connect to auction socket
    const socket = io(process.env.NEXT_PUBLIC_AUCTION_ENGINE_URL || 'http://localhost:3001');
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_auction', { auctionId: id, userId: currentUser?.id || 'anonymous' });
    });

    socket.on('new_bid', (data) => {
      setAuction(prev => prev ? { ...prev, current_price_eur: data.new_price, bids_count: data.bids_count } : prev);
      setBids(prev => [data.bid, ...prev].slice(0, 20));

      // Flash effect for new bid
      const priceEl = document.getElementById('current-price');
      if (priceEl) {
        priceEl.classList.add('scale-110', 'text-green-600');
        setTimeout(() => priceEl.classList.remove('scale-110', 'text-green-600'), 500);
      }
    });

    socket.on('viewer_count', ({ count }) => setViewerCount(count));

    socket.on('bid_error', ({ message }) => {
      setError(message);
      setLoading(false);
    });

    socket.on('bid_confirmed', () => {
      setLoading(false);
      setBidAmount('');
      setError('');
    });

    socket.on('auction_ended', (data) => {
      setAuction(prev => prev ? { ...prev, status: 'ended', winner_id: data.winner_id } : prev);
    });

    return () => {
      socket.emit('leave_auction', { auctionId: id, userId: currentUser?.id });
      socket.disconnect();
    };
  }, [id]);

  function placeBid() {
    if (!currentUser) {
      window.location.href = '/auth/login?redirect=/auction/' + id;
      return;
    }
    if (!socketRef.current || !auction) return;

    const amount = parseFloat(bidAmount);
    const minBid = auction.current_price_eur + auction.bid_increment_eur;

    if (isNaN(amount) || amount < minBid) {
      setError(`L'enchère minimum est de ${formatEur(minBid)}`);
      return;
    }

    setLoading(true);
    setError('');
    socketRef.current.emit('place_bid', {
      auctionId: id,
      userId: currentUser.id,
      amount,
      maxAutoBid: autoBidMax ? parseFloat(autoBidMax) : undefined,
    });
  }

  if (!auction) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-gold-400 border-t-transparent rounded-full animate-spin" /></div>;

  const minNextBid = auction.current_price_eur + auction.bid_increment_eur;
  const isEnded = auction.status === 'ended';
  const isLive = auction.status === 'live';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Images + Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          <div className="card overflow-hidden">
            <div className="aspect-video bg-gray-100 relative">
              {auction.listing?.images?.[0] ? (
                <Image src={auction.listing.images[0]} alt={auction.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">🏆</div>
              )}
              {isLive && (
                <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
              )}
              <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                <Users className="w-4 h-4" />
                {viewerCount} en direct
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="card p-6">
            <h1 className="font-display text-3xl font-bold text-gray-900 mb-4">{auction.title}</h1>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Poids</p>
                <p className="font-semibold">{auction.listing?.weight_grams}g</p>
              </div>
              <div>
                <p className="text-gray-500">Pureté</p>
                <p className="font-semibold">{auction.listing?.gold_purity}</p>
              </div>
              <div>
                <p className="text-gray-500">Prix de départ</p>
                <p className="font-semibold">{formatEur(auction.starting_price_eur)}</p>
              </div>
            </div>
          </div>

          {/* Bid History */}
          <div className="card p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gold-500" />
              Historique des enchères ({auction.bids_count})
            </h3>
            <div className="space-y-2">
              {bids.map((bid, i) => (
                <div key={bid.id} className={`flex items-center justify-between py-2 border-b border-gray-50 ${i === 0 ? 'text-green-700 font-semibold bg-green-50 px-2 rounded' : 'text-gray-600'}`}>
                  <div className="flex items-center gap-2">
                    {i === 0 && <ChevronUp className="w-4 h-4" />}
                    <span className="text-sm">{bid.bidder?.display_name || 'Enchérisseur anonyme'}</span>
                    {bid.is_auto_bid && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded">auto</span>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatEur(bid.amount_eur)}</p>
                    <p className="text-xs text-gray-400">{new Date(bid.created_at).toLocaleTimeString('fr-FR')}</p>
                  </div>
                </div>
              ))}
              {!bids.length && <p className="text-center text-gray-400 py-4">Aucune enchère pour le moment</p>}
            </div>
          </div>
        </div>

        {/* Right: Bid Panel */}
        <div className="space-y-4">
          {/* Current Price */}
          <div className="card p-6 text-center border-2 border-gold-200">
            <p className="text-sm text-gray-500 mb-1">Enchère actuelle</p>
            <p
              id="current-price"
              className="text-4xl font-display font-bold text-gold-700 transition-all duration-300"
            >
              {formatEur(auction.current_price_eur)}
            </p>
            {auction.reserve_met && (
              <p className="text-green-600 text-sm mt-1 flex items-center justify-center gap-1">
                ✓ Prix de réserve atteint
              </p>
            )}
          </div>

          {/* Countdown */}
          {isLive && (
            <div className={`card p-4 text-center ${timeLeft.total < 3600000 ? 'border-2 border-red-200' : ''}`}>
              <p className="text-sm text-gray-500 mb-1 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" />
                Temps restant
              </p>
              <div className="flex items-center justify-center gap-2 text-3xl font-bold">
                {timeLeft.h > 0 && (
                  <><span className={timeLeft.total < 3600000 ? 'text-red-600' : 'text-gray-900'}>{timeLeft.h}h</span></>
                )}
                <span className={timeLeft.total < 3600000 ? 'text-red-600 animate-pulse' : 'text-gray-900'}>
                  {String(timeLeft.m).padStart(2, '0')}m{String(timeLeft.s).padStart(2, '0')}s
                </span>
              </div>
            </div>
          )}

          {/* Bid Form */}
          {isLive && !isEnded && (
            <div className="card p-6 space-y-4">
              <h3 className="font-bold text-gray-900">Placer une enchère</h3>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="text-sm text-gray-600 block mb-1">
                  Montant (min. {formatEur(minNextBid)})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    min={minNextBid}
                    step={auction.bid_increment_eur}
                    placeholder={minNextBid.toString()}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-gold-400 text-lg font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
                </div>
              </div>

              {/* Quick bid buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[minNextBid, minNextBid + auction.bid_increment_eur, minNextBid + auction.bid_increment_eur * 2].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setBidAmount(amt.toString())}
                    className="border border-gold-300 text-gold-700 text-sm py-2 rounded-lg hover:bg-gold-50 transition-colors"
                  >
                    {formatEur(amt)}
                  </button>
                ))}
              </div>

              {/* Auto-bid */}
              <div>
                <label className="text-sm text-gray-600 block mb-1">
                  Enchère automatique max (optionnel)
                </label>
                <input
                  type="number"
                  value={autoBidMax}
                  onChange={e => setAutoBidMax(e.target.value)}
                  placeholder="Je mise jusqu'à..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gold-300"
                />
              </div>

              <button
                onClick={placeBid}
                disabled={loading || !bidAmount}
                className="w-full btn-gold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Zap className="w-5 h-5" />
                )}
                {loading ? 'Traitement...' : 'Enchérir maintenant'}
              </button>

              {/* Buy now */}
              {auction.buy_now_price_eur && (
                <button
                  onClick={() => socketRef.current?.emit('buy_now', { auctionId: id, userId: currentUser?.id })}
                  className="w-full btn-outline-gold text-sm"
                >
                  Acheter immédiatement — {formatEur(auction.buy_now_price_eur)}
                </button>
              )}
            </div>
          )}

          {/* Winner */}
          {isEnded && auction.winner_id && (
            <div className="card p-6 bg-green-50 border-2 border-green-200 text-center">
              <div className="text-4xl mb-2">🏆</div>
              <p className="font-bold text-green-800">Enchère terminée</p>
              <p className="text-2xl font-display font-bold text-green-700 mt-1">
                {formatEur(auction.current_price_eur)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
