-- ===========================================
-- ORFLOW PLATFORM - Initial Database Schema
-- ===========================================
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ===========================================
-- ENUMS
-- ===========================================

CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'both', 'admin');
CREATE TYPE listing_status AS ENUM ('draft', 'pending_review', 'active', 'sold', 'archived', 'rejected');
CREATE TYPE auction_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled', 'settled');
CREATE TYPE bid_status AS ENUM ('active', 'outbid', 'won', 'lost', 'cancelled');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'payment_pending', 'paid', 'shipping', 'delivered', 'disputed', 'refunded', 'cancelled');
CREATE TYPE gold_purity AS ENUM ('8k', '9k', '10k', '14k', '18k', '21k', '22k', '24k', '999', '995', 'unknown');
CREATE TYPE item_type AS ENUM ('ring', 'necklace', 'bracelet', 'earrings', 'coin', 'bar', 'scrap', 'watch', 'pendant', 'brooch', 'other');
CREATE TYPE notification_type AS ENUM ('bid_placed', 'bid_outbid', 'auction_won', 'auction_ended', 'listing_sold', 'offer_received', 'offer_accepted', 'offer_rejected', 'payment_received', 'system');
CREATE TYPE offer_status AS ENUM ('pending', 'accepted', 'rejected', 'countered', 'expired', 'cancelled');

-- ===========================================
-- PROFILES (extends Supabase auth.users)
-- ===========================================

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role user_role DEFAULT 'buyer',
  is_verified BOOLEAN DEFAULT FALSE,
  is_professional BOOLEAN DEFAULT FALSE,
  company_name TEXT,
  siret TEXT,
  bio TEXT,
  location_city TEXT,
  location_country TEXT DEFAULT 'FR',
  stripe_customer_id TEXT,
  stripe_account_id TEXT, -- for sellers (Stripe Connect)
  total_sales INTEGER DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,
  rating_as_seller DECIMAL(3,2),
  rating_as_buyer DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- GOLD MARKET DATA
-- ===========================================

CREATE TABLE gold_prices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  price_per_gram_eur DECIMAL(10,4) NOT NULL,
  price_per_troy_oz_usd DECIMAL(10,4) NOT NULL,
  source TEXT NOT NULL, -- 'goldapi', 'metals-api', 'manual'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for latest price queries
CREATE INDEX idx_gold_prices_timestamp ON gold_prices(timestamp DESC);

CREATE TABLE gold_price_history_daily (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  open_eur DECIMAL(10,4),
  high_eur DECIMAL(10,4),
  low_eur DECIMAL(10,4),
  close_eur DECIMAL(10,4),
  volume DECIMAL(20,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- LISTINGS (Seller Marketplace)
-- ===========================================

CREATE TABLE listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  item_type item_type NOT NULL,
  gold_purity gold_purity NOT NULL,
  weight_grams DECIMAL(10,3) NOT NULL,
  estimated_value_eur DECIMAL(10,2), -- AI estimated value
  asking_price_eur DECIMAL(10,2), -- seller asking price
  minimum_offer_eur DECIMAL(10,2),
  is_negotiable BOOLEAN DEFAULT TRUE,
  allow_offers BOOLEAN DEFAULT TRUE,
  allow_auction BOOLEAN DEFAULT FALSE,
  images TEXT[] DEFAULT '{}', -- array of storage URLs
  location_city TEXT,
  location_country TEXT DEFAULT 'FR',
  status listing_status DEFAULT 'draft',
  views_count INTEGER DEFAULT 0,
  offers_count INTEGER DEFAULT 0,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_item_type ON listings(item_type);
CREATE INDEX idx_listings_gold_purity ON listings(gold_purity);
CREATE INDEX idx_listings_price ON listings(asking_price_eur);
CREATE INDEX idx_listings_created ON listings(created_at DESC);
CREATE INDEX idx_listings_location ON listings(location_city);
-- Full text search
CREATE INDEX idx_listings_fts ON listings USING gin(to_tsvector('french', coalesce(title,'') || ' ' || coalesce(description,'')));

-- ===========================================
-- OFFERS (Buy Now / Negotiation)
-- ===========================================

CREATE TABLE offers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount_eur DECIMAL(10,2) NOT NULL,
  message TEXT,
  status offer_status DEFAULT 'pending',
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
  counter_offer_amount DECIMAL(10,2),
  counter_offer_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offers_listing ON offers(listing_id);
CREATE INDEX idx_offers_buyer ON offers(buyer_id);
CREATE INDEX idx_offers_seller ON offers(seller_id);
CREATE INDEX idx_offers_status ON offers(status);

-- ===========================================
-- AUCTIONS (Real-time Exchange)
-- ===========================================

CREATE TABLE auctions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  starting_price_eur DECIMAL(10,2) NOT NULL,
  reserve_price_eur DECIMAL(10,2), -- hidden minimum
  current_price_eur DECIMAL(10,2) NOT NULL,
  buy_now_price_eur DECIMAL(10,2),
  bid_increment_eur DECIMAL(10,2) DEFAULT 5.00,
  bids_count INTEGER DEFAULT 0,
  status auction_status DEFAULT 'scheduled',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  winner_id UUID REFERENCES profiles(id),
  winning_bid_id UUID,
  reserve_met BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_ends_at ON auctions(ends_at);
CREATE INDEX idx_auctions_seller ON auctions(seller_id);
CREATE INDEX idx_auctions_listing ON auctions(listing_id);

CREATE TABLE bids (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE NOT NULL,
  bidder_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount_eur DECIMAL(10,2) NOT NULL,
  max_auto_bid_eur DECIMAL(10,2), -- for auto-bidding
  status bid_status DEFAULT 'active',
  is_auto_bid BOOLEAN DEFAULT FALSE,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bids_auction ON bids(auction_id);
CREATE INDEX idx_bids_bidder ON bids(bidder_id);
CREATE INDEX idx_bids_amount ON bids(amount_eur DESC);
CREATE INDEX idx_bids_created ON bids(created_at DESC);

-- Update auctions.winning_bid_id FK after bids table creation
ALTER TABLE auctions ADD CONSTRAINT fk_winning_bid FOREIGN KEY (winning_bid_id) REFERENCES bids(id);

-- ===========================================
-- ORDERS (Settlement)
-- ===========================================

CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) NOT NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  auction_id UUID REFERENCES auctions(id),
  offer_id UUID REFERENCES offers(id),
  amount_eur DECIMAL(10,2) NOT NULL,
  platform_fee_eur DECIMAL(10,2) NOT NULL, -- 5% fee
  seller_payout_eur DECIMAL(10,2) NOT NULL,
  status order_status DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  shipping_address JSONB,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);

-- ===========================================
-- AI VALUATIONS
-- ===========================================

CREATE TABLE ai_valuations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  input_data JSONB NOT NULL, -- weight, purity, images, description
  estimated_weight_grams DECIMAL(10,3),
  confidence_weight DECIMAL(3,2),
  estimated_purity gold_purity,
  confidence_purity DECIMAL(3,2),
  market_value_eur DECIMAL(10,2),
  recommended_price_eur DECIMAL(10,2),
  arbitrage_opportunity BOOLEAN DEFAULT FALSE,
  arbitrage_profit_eur DECIMAL(10,2),
  model_used TEXT DEFAULT 'claude-3-haiku',
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- MARKET LISTINGS (Scraped Data)
-- ===========================================

CREATE TABLE scraped_listings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_url TEXT NOT NULL,
  source_platform TEXT NOT NULL, -- 'leboncoin', 'ebay', 'vinted', etc.
  title TEXT,
  description TEXT,
  price_eur DECIMAL(10,2),
  location TEXT,
  images TEXT[],
  raw_data JSONB,
  estimated_gold_grams DECIMAL(10,3),
  estimated_purity gold_purity,
  market_value_eur DECIMAL(10,2),
  arbitrage_profit_eur DECIMAL(10,2),
  arbitrage_margin_pct DECIMAL(5,2),
  is_opportunity BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_url)
);

CREATE INDEX idx_scraped_opportunity ON scraped_listings(is_opportunity, arbitrage_margin_pct DESC);
CREATE INDEX idx_scraped_platform ON scraped_listings(source_platform);
CREATE INDEX idx_scraped_at ON scraped_listings(scraped_at DESC);

-- ===========================================
-- NOTIFICATIONS
-- ===========================================

CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- ===========================================
-- REVIEWS
-- ===========================================

CREATE TABLE reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) NOT NULL,
  reviewer_id UUID REFERENCES profiles(id) NOT NULL,
  reviewee_id UUID REFERENCES profiles(id) NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, reviewer_id)
);

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER auctions_updated_at BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to calculate gold value
CREATE OR REPLACE FUNCTION calculate_gold_value(
  weight_grams DECIMAL,
  purity gold_purity,
  price_per_gram_eur DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  purity_factor DECIMAL;
BEGIN
  purity_factor := CASE purity
    WHEN '24k' THEN 1.0
    WHEN '999' THEN 0.999
    WHEN '995' THEN 0.995
    WHEN '22k' THEN 0.9167
    WHEN '21k' THEN 0.875
    WHEN '18k' THEN 0.75
    WHEN '14k' THEN 0.585
    WHEN '10k' THEN 0.417
    WHEN '9k' THEN 0.375
    WHEN '8k' THEN 0.333
    ELSE 0.5 -- unknown
  END;
  RETURN ROUND(weight_grams * purity_factor * price_per_gram_eur, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to process new bid (auto-bidding logic)
CREATE OR REPLACE FUNCTION process_bid(
  p_auction_id UUID,
  p_bidder_id UUID,
  p_amount DECIMAL,
  p_max_auto_bid DECIMAL DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_auction auctions%ROWTYPE;
  v_new_bid_id UUID;
  v_min_bid DECIMAL;
BEGIN
  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;

  IF v_auction.status != 'live' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auction is not live');
  END IF;

  IF NOW() > v_auction.ends_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auction has ended');
  END IF;

  v_min_bid := v_auction.current_price_eur + v_auction.bid_increment_eur;

  IF p_amount < v_min_bid THEN
    RETURN jsonb_build_object('success', false, 'error', format('Minimum bid is %s EUR', v_min_bid));
  END IF;

  -- Mark previous winning bid as outbid
  UPDATE bids SET status = 'outbid'
  WHERE auction_id = p_auction_id AND status = 'active';

  -- Insert new bid
  INSERT INTO bids (auction_id, bidder_id, amount_eur, max_auto_bid_eur, status)
  VALUES (p_auction_id, p_bidder_id, p_amount, p_max_auto_bid, 'active')
  RETURNING id INTO v_new_bid_id;

  -- Update auction
  UPDATE auctions SET
    current_price_eur = p_amount,
    bids_count = bids_count + 1,
    reserve_met = (p_amount >= COALESCE(reserve_price_eur, 0)),
    winning_bid_id = v_new_bid_id
  WHERE id = p_auction_id;

  RETURN jsonb_build_object('success', true, 'bid_id', v_new_bid_id, 'new_price', p_amount);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, own write
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_own_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Listings: public read active, seller can manage own
CREATE POLICY "listings_public_read" ON listings FOR SELECT USING (status = 'active' OR auth.uid() = seller_id);
CREATE POLICY "listings_seller_insert" ON listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "listings_seller_update" ON listings FOR UPDATE USING (auth.uid() = seller_id);

-- Offers: participants can see
CREATE POLICY "offers_participants" ON offers FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "offers_buyer_insert" ON offers FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "offers_participants_update" ON offers FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Auctions: public read
CREATE POLICY "auctions_public_read" ON auctions FOR SELECT USING (true);
CREATE POLICY "auctions_seller_insert" ON auctions FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- Bids: authenticated users can read and insert
CREATE POLICY "bids_authenticated_read" ON bids FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "bids_authenticated_insert" ON bids FOR INSERT WITH CHECK (auth.uid() = bidder_id);

-- Orders: participants only
CREATE POLICY "orders_participants" ON orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Notifications: own only
CREATE POLICY "notifications_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_own_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ===========================================
-- REALTIME (enable for auction tables)
-- ===========================================
ALTER PUBLICATION supabase_realtime ADD TABLE auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;
ALTER PUBLICATION supabase_realtime ADD TABLE offers;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
