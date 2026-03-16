// ===========================================
// ORFLOW - Matching Engine
// Order book for buyer/seller matching
// Inspired by Peatio exchange architecture
// ===========================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===========================================
// Order Book
// ===========================================

interface Order {
  id: string;
  userId: string;
  type: 'buy' | 'sell';
  itemType: string;
  goldPurity: string;
  weightGrams: number;
  pricePerGramEur: number;
  totalEur: number;
  locationCity: string;
  createdAt: Date;
  listingId?: string;
}

class OrderBook {
  private buyOrders: Order[] = []; // sorted by price DESC (highest buyer first)
  private sellOrders: Order[] = []; // sorted by price ASC (lowest seller first)

  addBuyOrder(order: Order): MatchResult[] {
    this.buyOrders.push(order);
    this.buyOrders.sort((a, b) => b.pricePerGramEur - a.pricePerGramEur);
    return this.tryMatch();
  }

  addSellOrder(order: Order): MatchResult[] {
    this.sellOrders.push(order);
    this.sellOrders.sort((a, b) => a.pricePerGramEur - b.pricePerGramEur);
    return this.tryMatch();
  }

  private tryMatch(): MatchResult[] {
    const matches: MatchResult[] = [];

    while (this.buyOrders.length > 0 && this.sellOrders.length > 0) {
      const bestBuy = this.buyOrders[0];
      const bestSell = this.sellOrders[0];

      // Match if buyer's max price >= seller's min price
      if (bestBuy.pricePerGramEur >= bestSell.pricePerGramEur) {
        const matchedWeight = Math.min(bestBuy.weightGrams, bestSell.weightGrams);
        const executionPrice = (bestBuy.pricePerGramEur + bestSell.pricePerGramEur) / 2;

        matches.push({
          buyOrderId: bestBuy.id,
          sellOrderId: bestSell.id,
          buyerId: bestBuy.userId,
          sellerId: bestSell.userId,
          weightGrams: matchedWeight,
          pricePerGramEur: executionPrice,
          totalEur: matchedWeight * executionPrice,
          executedAt: new Date(),
        });

        // Update or remove orders
        bestBuy.weightGrams -= matchedWeight;
        bestSell.weightGrams -= matchedWeight;

        if (bestBuy.weightGrams <= 0) this.buyOrders.shift();
        if (bestSell.weightGrams <= 0) this.sellOrders.shift();
      } else {
        break; // No more matches possible
      }
    }

    return matches;
  }

  getDepth(): OrderBookDepth {
    const buyDepth = this.buyOrders.slice(0, 10).map(o => ({
      price: o.pricePerGramEur,
      weight: o.weightGrams,
      total: o.totalEur,
    }));

    const sellDepth = this.sellOrders.slice(0, 10).map(o => ({
      price: o.pricePerGramEur,
      weight: o.weightGrams,
      total: o.totalEur,
    }));

    const spread = this.buyOrders[0] && this.sellOrders[0]
      ? this.sellOrders[0].pricePerGramEur - this.buyOrders[0].pricePerGramEur
      : null;

    return { buyDepth, sellDepth, spread };
  }
}

interface MatchResult {
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  weightGrams: number;
  pricePerGramEur: number;
  totalEur: number;
  executedAt: Date;
}

interface OrderBookDepth {
  buyDepth: Array<{ price: number; weight: number; total: number }>;
  sellDepth: Array<{ price: number; weight: number; total: number }>;
  spread: number | null;
}

// ===========================================
// Lead Distribution Engine
// Routes seller leads to most relevant buyers
// ===========================================

interface LeadScore {
  buyerId: string;
  score: number;
  reasons: string[];
}

export async function distributeLead(listingId: string): Promise<LeadScore[]> {
  // Get the listing details
  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single();

  if (!listing) return [];

  // Find active buyers with matching interests
  const { data: buyers } = await supabase
    .from('profiles')
    .select('id, location_city, is_professional, total_purchases')
    .in('role', ['buyer', 'both'])
    .eq('is_verified', true);

  if (!buyers) return [];

  const scores: LeadScore[] = buyers.map(buyer => {
    let score = 0;
    const reasons: string[] = [];

    // Location match (proximity bonus)
    if (buyer.location_city === listing.location_city) {
      score += 30;
      reasons.push('Same city');
    }

    // Professional buyers get priority
    if (buyer.is_professional) {
      score += 20;
      reasons.push('Professional buyer');
    }

    // Active buyers
    if (buyer.total_purchases > 10) {
      score += 15;
      reasons.push('Active buyer');
    }

    return { buyerId: buyer.id, score, reasons };
  });

  // Return top 10 by score
  return scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// Export the order book instance
export const goldOrderBook = new OrderBook();

export { OrderBook, MatchResult, OrderBookDepth };
