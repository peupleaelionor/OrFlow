-- ===========================================
-- ORFLOW - Seed Data for Development
-- ===========================================

-- Insert current gold price (approximate)
INSERT INTO gold_prices (price_per_gram_eur, price_per_troy_oz_usd, source) VALUES
(58.50, 2020.00, 'seed'),
(58.32, 2013.00, 'seed'),
(59.10, 2042.00, 'seed');

-- Insert historical daily prices
INSERT INTO gold_price_history_daily (date, open_eur, high_eur, low_eur, close_eur) VALUES
(CURRENT_DATE - 7, 57.80, 58.90, 57.60, 58.40),
(CURRENT_DATE - 6, 58.40, 58.80, 58.10, 58.60),
(CURRENT_DATE - 5, 58.60, 59.20, 58.30, 58.90),
(CURRENT_DATE - 4, 58.90, 59.50, 58.70, 59.10),
(CURRENT_DATE - 3, 59.10, 59.80, 58.80, 59.30),
(CURRENT_DATE - 2, 59.30, 59.60, 58.90, 58.80),
(CURRENT_DATE - 1, 58.80, 59.00, 58.40, 58.50),
(CURRENT_DATE, 58.50, 58.70, 58.20, 58.50);

-- Note: Real user data will be created through auth flow
-- These are example scraped listings for the arbitrage dashboard

INSERT INTO scraped_listings (
  source_url, source_platform, title, description,
  price_eur, location, images,
  estimated_gold_grams, estimated_purity, market_value_eur,
  arbitrage_profit_eur, arbitrage_margin_pct, is_opportunity, processed
) VALUES
(
  'https://www.leboncoin.fr/ad/example-1',
  'leboncoin',
  'Lot bijoux or 18k - 35g',
  'Je vends un lot de bijoux en or 18 carats, 35 grammes au total. Bagues, colliers, bracelets.',
  950, 'Paris',
  '{}',
  35, '18k', 1538.00,
  588.00, 61.9, true, true
),
(
  'https://www.leboncoin.fr/ad/example-2',
  'leboncoin',
  'Alliance or 18k + bague diamant 6g',
  'Vends alliance et bague diamant or 18k, total 6g. Urgent.',
  180, 'Lyon',
  '{}',
  6, '18k', 263.25,
  83.25, 46.3, true, true
),
(
  'https://www.ebay.fr/itm/example-3',
  'ebay_fr',
  'Pièce 20 Francs Napoléon III or',
  'Pièce 20 francs Napoléon III 1867. Très bon état. Or 900/1000.',
  280, 'Marseille',
  '{}',
  5.81, '22k', 319.00,
  39.00, 13.9, false, true
);
