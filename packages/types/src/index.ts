// ===========================================
// ORFLOW PLATFORM - Shared TypeScript Types
// ===========================================

export type UserRole = 'buyer' | 'seller' | 'both' | 'admin';
export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'sold' | 'archived' | 'rejected';
export type AuctionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled' | 'settled';
export type BidStatus = 'active' | 'outbid' | 'won' | 'lost' | 'cancelled';
export type OrderStatus = 'pending' | 'confirmed' | 'payment_pending' | 'paid' | 'shipping' | 'delivered' | 'disputed' | 'refunded' | 'cancelled';
export type GoldPurity = '8k' | '9k' | '10k' | '14k' | '18k' | '21k' | '22k' | '24k' | '999' | '995' | 'unknown';
export type ItemType = 'ring' | 'necklace' | 'bracelet' | 'earrings' | 'coin' | 'bar' | 'scrap' | 'watch' | 'pendant' | 'brooch' | 'other';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired' | 'cancelled';

// Gold purity factors (fine gold content)
export const GOLD_PURITY_FACTORS: Record<GoldPurity, number> = {
  '24k': 1.0,
  '999': 0.999,
  '995': 0.995,
  '22k': 0.9167,
  '21k': 0.875,
  '18k': 0.75,
  '14k': 0.585,
  '10k': 0.417,
  '9k': 0.375,
  '8k': 0.333,
  'unknown': 0.5,
};

export const GOLD_PURITY_LABELS: Record<GoldPurity, string> = {
  '24k': '24 carats (Or pur)',
  '999': '999‰ (Lingot fin)',
  '995': '995‰ (Lingot investissement)',
  '22k': '22 carats',
  '21k': '21 carats',
  '18k': '18 carats (Or joaillerie)',
  '14k': '14 carats',
  '10k': '10 carats',
  '9k': '9 carats',
  '8k': '8 carats',
  'unknown': 'Pureté inconnue',
};

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: UserRole;
  is_verified: boolean;
  is_professional: boolean;
  company_name: string | null;
  location_city: string | null;
  location_country: string;
  stripe_customer_id: string | null;
  stripe_account_id: string | null;
  total_sales: number;
  total_purchases: number;
  rating_as_seller: number | null;
  rating_as_buyer: number | null;
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  seller_id: string;
  seller?: Profile;
  title: string;
  description: string | null;
  item_type: ItemType;
  gold_purity: GoldPurity;
  weight_grams: number;
  estimated_value_eur: number | null;
  asking_price_eur: number | null;
  minimum_offer_eur: number | null;
  is_negotiable: boolean;
  allow_offers: boolean;
  allow_auction: boolean;
  images: string[];
  location_city: string | null;
  location_country: string;
  status: ListingStatus;
  views_count: number;
  offers_count: number;
  created_at: string;
  updated_at: string;
}

export interface Auction {
  id: string;
  listing_id: string;
  listing?: Listing;
  seller_id: string;
  seller?: Profile;
  title: string;
  starting_price_eur: number;
  reserve_price_eur: number | null;
  current_price_eur: number;
  buy_now_price_eur: number | null;
  bid_increment_eur: number;
  bids_count: number;
  status: AuctionStatus;
  starts_at: string;
  ends_at: string;
  winner_id: string | null;
  winner?: Profile;
  winning_bid_id: string | null;
  reserve_met: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  bidder_id: string;
  bidder?: Profile;
  amount_eur: number;
  max_auto_bid_eur: number | null;
  status: BidStatus;
  is_auto_bid: boolean;
  created_at: string;
}

export interface Offer {
  id: string;
  listing_id: string;
  listing?: Listing;
  buyer_id: string;
  buyer?: Profile;
  seller_id: string;
  amount_eur: number;
  message: string | null;
  status: OfferStatus;
  expires_at: string;
  counter_offer_amount: number | null;
  counter_offer_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  listing_id: string;
  listing?: Listing;
  buyer_id: string;
  buyer?: Profile;
  seller_id: string;
  seller?: Profile;
  auction_id: string | null;
  offer_id: string | null;
  amount_eur: number;
  platform_fee_eur: number;
  seller_payout_eur: number;
  status: OrderStatus;
  stripe_payment_intent_id: string | null;
  shipping_address: ShippingAddress | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postal_code: string;
  country: string;
}

export interface GoldPrice {
  id: string;
  price_per_gram_eur: number;
  price_per_troy_oz_usd: number;
  source: string;
  timestamp: string;
}

export interface GoldValuation {
  weight_grams: number;
  purity: GoldPurity;
  purity_factor: number;
  fine_gold_grams: number;
  price_per_gram_eur: number;
  market_value_eur: number;
  recommended_price_eur: number; // 85% of market value (typical buyer rate)
  refinery_payout_eur: number;   // 96% of market value
}

export interface AiValuation {
  id: string;
  listing_id: string | null;
  estimated_weight_grams: number | null;
  confidence_weight: number | null;
  estimated_purity: GoldPurity | null;
  confidence_purity: number | null;
  market_value_eur: number | null;
  recommended_price_eur: number | null;
  arbitrage_opportunity: boolean;
  arbitrage_profit_eur: number | null;
  created_at: string;
}

export interface ScrapedListing {
  id: string;
  source_url: string;
  source_platform: string;
  title: string | null;
  description: string | null;
  price_eur: number | null;
  location: string | null;
  images: string[];
  estimated_gold_grams: number | null;
  estimated_purity: GoldPurity | null;
  market_value_eur: number | null;
  arbitrage_profit_eur: number | null;
  arbitrage_margin_pct: number | null;
  is_opportunity: boolean;
  scraped_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// WebSocket events (auction real-time)
export interface AuctionBidEvent {
  type: 'NEW_BID';
  auction_id: string;
  bid: Bid;
  new_price: number;
  bids_count: number;
}

export interface AuctionStatusEvent {
  type: 'AUCTION_STATUS_CHANGE';
  auction_id: string;
  status: AuctionStatus;
}

export type AuctionRealtimeEvent = AuctionBidEvent | AuctionStatusEvent;
