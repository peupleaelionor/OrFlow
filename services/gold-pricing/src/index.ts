// ===========================================
// ORFLOW - Gold Pricing Service
// Calculates real-time gold valuations
// Formula: value = grams × (carat/24) × market_price
// ===========================================

import { GOLD_PURITY_FACTORS, GoldPurity, GoldValuation } from '@orflow/types';

const TROY_OZ_IN_GRAMS = 31.1035;
const PLATFORM_BUYER_RATE = 0.85; // 85% of spot - competitive for buyers
const REFINERY_RATE = 0.96;        // 96% of spot - refinery payout

// ===========================================
// Core Valuation Engine
// ===========================================

export function calculateGoldValue(
  weightGrams: number,
  purity: GoldPurity,
  pricePerGramEur: number
): GoldValuation {
  const purityFactor = GOLD_PURITY_FACTORS[purity];
  const fineGoldGrams = weightGrams * purityFactor;
  const marketValue = fineGoldGrams * pricePerGramEur;

  return {
    weight_grams: weightGrams,
    purity,
    purity_factor: purityFactor,
    fine_gold_grams: fineGoldGrams,
    price_per_gram_eur: pricePerGramEur,
    market_value_eur: Math.round(marketValue * 100) / 100,
    recommended_price_eur: Math.round(marketValue * PLATFORM_BUYER_RATE * 100) / 100,
    refinery_payout_eur: Math.round(marketValue * REFINERY_RATE * 100) / 100,
  };
}

export function usdPerTroyOzToEurPerGram(
  usdPerTroyOz: number,
  eurUsdRate: number = 1.08
): number {
  return (usdPerTroyOz / eurUsdRate) / TROY_OZ_IN_GRAMS;
}

// ===========================================
// Gold Price Fetcher (multiple sources)
// ===========================================

interface GoldPriceResult {
  pricePerGramEur: number;
  pricePerTroyOzUsd: number;
  source: string;
  timestamp: Date;
}

export async function fetchCurrentGoldPrice(): Promise<GoldPriceResult> {
  const sources = [
    fetchFromGoldApi,
    fetchFromMetalsApi,
    fetchFromOpenExchangeRates,
  ];

  for (const fetchFn of sources) {
    try {
      const result = await fetchFn();
      if (result) return result;
    } catch (e) {
      console.error(`Gold price fetch failed:`, e);
    }
  }

  // Fallback: use cached or approximate value
  return {
    pricePerGramEur: 58.5, // approximate EUR/gram for 24k gold
    pricePerTroyOzUsd: 2050,
    source: 'fallback',
    timestamp: new Date(),
  };
}

async function fetchFromGoldApi(): Promise<GoldPriceResult | null> {
  const apiKey = process.env.GOLD_API_KEY;
  if (!apiKey) return null;

  const res = await fetch('https://www.goldapi.io/api/XAU/EUR', {
    headers: { 'x-access-token': apiKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;
  const data = await res.json();

  return {
    pricePerGramEur: data.price_gram_24k,
    pricePerTroyOzUsd: data.price,
    source: 'goldapi.io',
    timestamp: new Date(data.timestamp * 1000),
  };
}

async function fetchFromMetalsApi(): Promise<GoldPriceResult | null> {
  const apiKey = process.env.METALS_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `https://metals-api.com/api/latest?access_key=${apiKey}&base=EUR&symbols=XAU`,
    { signal: AbortSignal.timeout(5000) }
  );

  if (!res.ok) return null;
  const data = await res.json();
  if (!data.success) return null;

  const xauPerEur = data.rates.XAU; // troy oz per EUR
  const eurPerTroyOz = 1 / xauPerEur;
  const eurPerGram = eurPerTroyOz / TROY_OZ_IN_GRAMS;

  return {
    pricePerGramEur: eurPerGram,
    pricePerTroyOzUsd: eurPerTroyOz * 1.08,
    source: 'metals-api.com',
    timestamp: new Date(),
  };
}

async function fetchFromOpenExchangeRates(): Promise<GoldPriceResult | null> {
  // Free fallback using Open Exchange Rates + LBMA
  const res = await fetch(
    'https://openexchangerates.org/api/latest.json?app_id=' + process.env.OPEN_EXCHANGE_APP_ID,
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) return null;
  const data = await res.json();

  // XAU is typically available in the rates
  const usdPerTroyOz = data.rates?.XAU ? (1 / data.rates.XAU) : 2050;
  const eurUsdRate = data.rates?.EUR || 0.92;
  const eurPerTroyOz = usdPerTroyOz * eurUsdRate;
  const eurPerGram = eurPerTroyOz / TROY_OZ_IN_GRAMS;

  return {
    pricePerGramEur: eurPerGram,
    pricePerTroyOzUsd: usdPerTroyOz,
    source: 'openexchangerates.org',
    timestamp: new Date(),
  };
}

// ===========================================
// Arbitrage Detection
// ===========================================

export interface ArbitrageOpportunity {
  source_url: string;
  title: string;
  listed_price_eur: number;
  estimated_market_value_eur: number;
  profit_eur: number;
  margin_pct: number;
  is_opportunity: boolean;
}

export function detectArbitrage(
  listedPriceEur: number,
  estimatedMarketValueEur: number,
  minMarginPct: number = 30
): ArbitrageOpportunity['margin_pct'] {
  if (listedPriceEur <= 0) return 0;
  return ((estimatedMarketValueEur - listedPriceEur) / listedPriceEur) * 100;
}

export function isArbitrageOpportunity(
  listedPriceEur: number,
  marketValueEur: number,
  threshold: number = 30
): boolean {
  const margin = detectArbitrage(listedPriceEur, marketValueEur);
  return margin >= threshold;
}

// ===========================================
// Regional Price Intelligence
// ===========================================

export interface RegionalGoldPrice {
  city: string;
  region: string;
  average_buy_price_per_gram: number; // what local dealers pay
  average_sell_price_per_gram: number; // what dealers charge
  spread_pct: number;
}

// Typical French market data (updated manually or via scraping)
export const FRENCH_MARKET_PRICES: RegionalGoldPrice[] = [
  { city: 'Paris', region: 'Île-de-France', average_buy_price_per_gram: 50.2, average_sell_price_per_gram: 62.1, spread_pct: 23.7 },
  { city: 'Lyon', region: 'Auvergne-Rhône-Alpes', average_buy_price_per_gram: 49.8, average_sell_price_per_gram: 61.5, spread_pct: 23.5 },
  { city: 'Marseille', region: 'PACA', average_buy_price_per_gram: 49.5, average_sell_price_per_gram: 61.2, spread_pct: 23.6 },
  { city: 'Bordeaux', region: 'Nouvelle-Aquitaine', average_buy_price_per_gram: 49.0, average_sell_price_per_gram: 60.8, spread_pct: 24.1 },
  { city: 'Toulouse', region: 'Occitanie', average_buy_price_per_gram: 49.1, average_sell_price_per_gram: 61.0, spread_pct: 24.2 },
  { city: 'Nantes', region: 'Pays de la Loire', average_buy_price_per_gram: 49.3, average_sell_price_per_gram: 61.1, spread_pct: 23.9 },
  { city: 'Strasbourg', region: 'Grand Est', average_buy_price_per_gram: 49.6, average_sell_price_per_gram: 61.3, spread_pct: 23.6 },
  { city: 'Lille', region: 'Hauts-de-France', average_buy_price_per_gram: 49.4, average_sell_price_per_gram: 61.1, spread_pct: 23.7 },
];

export function getRegionalPrice(city: string): RegionalGoldPrice | null {
  return FRENCH_MARKET_PRICES.find(
    p => p.city.toLowerCase() === city.toLowerCase()
  ) || null;
}
