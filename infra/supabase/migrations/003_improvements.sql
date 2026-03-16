-- ===========================================
-- ORFLOW - Improvements based on reference repos analysis
-- Patterns from: auctions-next-supabase, mercurjs/mercur, peatio
-- ===========================================

-- ===========================================
-- 1. ANTI-SNIPE LOGIC (from functionfirst pattern)
-- If bid arrives within 5min of end, extend by 5min
-- ===========================================

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
  v_current_winner UUID;
  v_anti_snipe_window INTERVAL := INTERVAL '5 minutes';
  v_anti_snipe_extension INTERVAL := INTERVAL '5 minutes';
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

  -- Prevent self-bidding (from functionfirst pattern)
  SELECT bidder_id INTO v_current_winner
  FROM bids
  WHERE auction_id = p_auction_id AND status = 'active'
  ORDER BY amount_eur DESC
  LIMIT 1;

  IF v_current_winner = p_bidder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already the highest bidder');
  END IF;

  -- Mark previous winning bid as outbid
  UPDATE bids SET status = 'outbid'
  WHERE auction_id = p_auction_id AND status = 'active';

  -- Insert new bid
  INSERT INTO bids (auction_id, bidder_id, amount_eur, max_auto_bid_eur, status)
  VALUES (p_auction_id, p_bidder_id, p_amount, p_max_auto_bid, 'active')
  RETURNING id INTO v_new_bid_id;

  -- Anti-snipe: extend auction if bid arrives in last 5 minutes
  IF v_auction.ends_at - NOW() < v_anti_snipe_window THEN
    UPDATE auctions SET
      ends_at = ends_at + v_anti_snipe_extension,
      current_price_eur = p_amount,
      bids_count = bids_count + 1,
      reserve_met = (p_amount >= COALESCE(reserve_price_eur, 0)),
      winning_bid_id = v_new_bid_id
    WHERE id = p_auction_id;

    RETURN jsonb_build_object(
      'success', true,
      'bid_id', v_new_bid_id,
      'new_price', p_amount,
      'anti_sniped', true,
      'new_end_time', v_auction.ends_at + v_anti_snipe_extension
    );
  ELSE
    UPDATE auctions SET
      current_price_eur = p_amount,
      bids_count = bids_count + 1,
      reserve_met = (p_amount >= COALESCE(reserve_price_eur, 0)),
      winning_bid_id = v_new_bid_id
    WHERE id = p_auction_id;

    RETURN jsonb_build_object(
      'success', true,
      'bid_id', v_new_bid_id,
      'new_price', p_amount,
      'anti_sniped', false
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 2. WATCHLIST (from functionfirst pattern)
-- ===========================================

CREATE TABLE IF NOT EXISTS watchlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, listing_id),
  UNIQUE(user_id, auction_id),
  CHECK (listing_id IS NOT NULL OR auction_id IS NOT NULL)
);

ALTER TABLE watchlists REPLICA IDENTITY FULL; -- enables realtime DELETE events

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlists_own" ON watchlists FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);

-- Toggle watchlist function
CREATE OR REPLACE FUNCTION toggle_watchlist(
  p_user_id UUID,
  p_listing_id UUID DEFAULT NULL,
  p_auction_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF p_listing_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM watchlists WHERE user_id = p_user_id AND listing_id = p_listing_id) INTO v_exists;
    IF v_exists THEN
      DELETE FROM watchlists WHERE user_id = p_user_id AND listing_id = p_listing_id;
      RETURN jsonb_build_object('action', 'removed', 'listing_id', p_listing_id);
    ELSE
      INSERT INTO watchlists (user_id, listing_id) VALUES (p_user_id, p_listing_id);
      RETURN jsonb_build_object('action', 'added', 'listing_id', p_listing_id);
    END IF;
  ELSIF p_auction_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM watchlists WHERE user_id = p_user_id AND auction_id = p_auction_id) INTO v_exists;
    IF v_exists THEN
      DELETE FROM watchlists WHERE user_id = p_user_id AND auction_id = p_auction_id;
      RETURN jsonb_build_object('action', 'removed', 'auction_id', p_auction_id);
    ELSE
      INSERT INTO watchlists (user_id, auction_id) VALUES (p_user_id, p_auction_id);
      RETURN jsonb_build_object('action', 'added', 'auction_id', p_auction_id);
    END IF;
  END IF;
  RETURN jsonb_build_object('error', 'Must provide listing_id or auction_id');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 3. COMMISSION RULES ENGINE (from Mercur pattern)
-- More flexible than flat 5% fee
-- ===========================================

CREATE TYPE commission_scope AS ENUM ('global', 'category', 'seller', 'item_type');
CREATE TYPE commission_rule_type AS ENUM ('flat', 'percentage', 'mixed');

CREATE TABLE commission_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  scope_type commission_scope DEFAULT 'global',
  scope_id TEXT, -- seller_id or item_type value, NULL for global
  rule_type commission_rule_type DEFAULT 'percentage',
  flat_amount_eur DECIMAL(10,2) DEFAULT 0,
  pct_amount DECIMAL(5,4) DEFAULT 0.05, -- 5% default
  priority INTEGER DEFAULT 0, -- higher priority wins
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default global rule: 5%
INSERT INTO commission_rules (scope_type, rule_type, pct_amount, priority)
VALUES ('global', 'percentage', 0.05, 0);

-- Function to calculate commission for a given order
CREATE OR REPLACE FUNCTION calculate_commission(
  p_amount_eur DECIMAL,
  p_seller_id UUID,
  p_item_type TEXT DEFAULT NULL
) RETURNS DECIMAL AS $$
DECLARE
  v_rule commission_rules%ROWTYPE;
  v_commission DECIMAL;
BEGIN
  -- Find the most specific active rule (highest priority)
  SELECT * INTO v_rule FROM commission_rules
  WHERE active = TRUE
    AND (
      (scope_type = 'seller' AND scope_id = p_seller_id::TEXT) OR
      (scope_type = 'item_type' AND scope_id = p_item_type) OR
      (scope_type = 'global')
    )
  ORDER BY priority DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- Fallback: 5%
    RETURN ROUND(p_amount_eur * 0.05, 2);
  END IF;

  CASE v_rule.rule_type
    WHEN 'percentage' THEN
      v_commission := ROUND(p_amount_eur * v_rule.pct_amount, 2);
    WHEN 'flat' THEN
      v_commission := v_rule.flat_amount_eur;
    WHEN 'mixed' THEN
      v_commission := v_rule.flat_amount_eur + ROUND(p_amount_eur * v_rule.pct_amount, 2);
  END CASE;

  RETURN v_commission;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===========================================
-- 4. BROADCAST TRIGGER (better realtime — from Supabase docs)
-- More efficient than postgres_changes for high-traffic auctions
-- ===========================================

CREATE OR REPLACE FUNCTION broadcast_bid()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'auction:' || NEW.auction_id::TEXT,
    'INSERT',
    'bids',
    NEW.id::TEXT,
    NULL,
    row_to_json(NEW)::JSONB,
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bids_broadcast
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_bid();

-- ===========================================
-- 5. PRODUCT CATALOG (from Medusa/Mercur pattern)
-- Normalize gold product types separately from listings
-- ===========================================

CREATE TYPE product_category AS ENUM ('coin', 'bar', 'round', 'jewelry', 'scrap');

CREATE TABLE gold_products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, -- "Maple Leaf 1oz", "Napoléon 20F", "Alliance 18k"
  category product_category NOT NULL,
  weight_grams DECIMAL(10,4) NOT NULL,
  purity gold_purity NOT NULL,
  fine_gold_grams DECIMAL(10,4) GENERATED ALWAYS AS (
    weight_grams * CASE purity
      WHEN '24k' THEN 1.0 WHEN '999' THEN 0.999 WHEN '995' THEN 0.995
      WHEN '22k' THEN 0.9167 WHEN '21k' THEN 0.875 WHEN '18k' THEN 0.75
      WHEN '14k' THEN 0.585 WHEN '10k' THEN 0.417 WHEN '9k' THEN 0.375
      WHEN '8k' THEN 0.333 ELSE 0.5
    END
  ) STORED,
  issuer TEXT, -- Monnaie de Paris, Royal Canadian Mint, etc.
  year_minted INTEGER,
  image_url TEXT,
  is_numismatic BOOLEAN DEFAULT FALSE, -- has collector premium
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link listings to product catalog (optional, for standardized items)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES gold_products(id);

-- Seed common gold products
INSERT INTO gold_products (name, category, weight_grams, purity, issuer, is_numismatic) VALUES
('Lingot 1kg (999‰)', 'bar', 1000.0, '999', 'LBMA', false),
('Lingot 100g (999‰)', 'bar', 100.0, '999', 'LBMA', false),
('Lingot 50g (999‰)', 'bar', 50.0, '999', 'LBMA', false),
('Lingot 10g (999‰)', 'bar', 10.0, '999', 'LBMA', false),
('Lingot 1g (999‰)', 'bar', 1.0, '999', 'LBMA', false),
('Pièce 20 Francs Napoléon', 'coin', 6.45, '22k', 'Monnaie de Paris', true),
('Pièce 20 Francs Suisse Vreneli', 'coin', 6.45, '22k', 'Monnaie fédérale suisse', true),
('Maple Leaf 1oz (999‰)', 'coin', 31.1035, '999', 'Royal Canadian Mint', false),
('Krugerrand 1oz', 'coin', 33.93, '22k', 'South African Mint', false),
('Britannia 1oz (999‰)', 'coin', 31.1035, '999', 'Royal Mint UK', false),
('Philharmonique 1oz (999‰)', 'coin', 31.1035, '999', 'Münze Österreich', false);

-- ===========================================
-- 6. SELLER REQUEST QUEUE (from Mercur pattern)
-- Listings require admin approval before going live
-- ===========================================

CREATE TYPE request_type AS ENUM ('listing_approval', 'seller_verification', 'return_request');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'escalated');

CREATE TABLE admin_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type request_type NOT NULL,
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  related_listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  status request_status DEFAULT 'pending',
  notes TEXT,
  admin_response TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_requests_status ON admin_requests(status, type);

ALTER TABLE admin_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_own_read" ON admin_requests FOR SELECT USING (auth.uid() = requester_id);
CREATE POLICY "requests_own_insert" ON admin_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- ===========================================
-- Add watchlists to realtime
-- ===========================================
ALTER PUBLICATION supabase_realtime ADD TABLE watchlists;
ALTER PUBLICATION supabase_realtime ADD TABLE gold_prices;
