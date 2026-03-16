// ===========================================
// ORFLOW - Data Collection Engine
// Multi-source gold listing scraper
// Architecture: scrapers → queue → AI processing → DB
// ===========================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RATE_LIMIT_MS = parseInt(process.env.SCRAPER_RATE_LIMIT_MS || '5000');
const USER_AGENT = process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (compatible; OrFlowBot/1.0)';

// ===========================================
// Gold-related search keywords
// ===========================================

export const GOLD_KEYWORDS = [
  'bijoux or', 'or 18k', 'or 14k', 'or 9k',
  'lot bijoux or', 'or cassé', 'or recycler',
  'bague or', 'collier or', 'bracelet or',
  'lingot or', 'piece or', 'monnaie or',
  'or ancien', 'bijoux anciens or',
];

export const FRENCH_CITIES = [
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux',
  'Nantes', 'Strasbourg', 'Lille', 'Rennes', 'Montpellier',
  'Nice', 'Grenoble', 'Dijon', 'Clermont-Ferrand', 'Tours',
];

// ===========================================
// Base Scraper Interface
// ===========================================

export interface ScrapedItem {
  source_url: string;
  source_platform: string;
  title: string;
  description: string;
  price_eur: number | null;
  location: string | null;
  images: string[];
  raw_data: Record<string, unknown>;
}

abstract class BaseScraper {
  abstract platform: string;
  abstract searchUrl(keyword: string, city?: string): string;
  abstract parseListings(html: string, baseUrl: string): ScrapedItem[];

  async fetch(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  async scrapeKeyword(keyword: string, city?: string): Promise<ScrapedItem[]> {
    const url = this.searchUrl(keyword, city);
    const html = await this.fetch(url);
    if (!html) return [];
    return this.parseListings(html, url);
  }
}

// ===========================================
// LeBonCoin Scraper
// ===========================================

class LeBonCoinScraper extends BaseScraper {
  platform = 'leboncoin';

  searchUrl(keyword: string, city?: string): string {
    const params = new URLSearchParams({
      text: keyword,
      category: '17', // bijoux/montres category
    });
    if (city) params.set('locations', city);
    return `https://www.leboncoin.fr/recherche?${params.toString()}`;
  }

  parseListings(html: string, _baseUrl: string): ScrapedItem[] {
    // Note: LeBonCoin uses Next.js SSR - parse __NEXT_DATA__
    const items: ScrapedItem[] = [];

    try {
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (!match) return items;

      const data = JSON.parse(match[1]);
      const listings = data?.props?.pageProps?.searchData?.ads || [];

      for (const ad of listings.slice(0, 20)) {
        const price = ad.price?.[0] || null;
        const imageUrls = (ad.images?.urls_large || ad.images?.urls || []).slice(0, 5);

        items.push({
          source_url: `https://www.leboncoin.fr/ad/${ad.list_id}`,
          source_platform: this.platform,
          title: ad.subject || '',
          description: ad.body || '',
          price_eur: price,
          location: ad.location?.city || null,
          images: imageUrls,
          raw_data: { category: ad.category_name, owner: ad.owner?.name },
        });
      }
    } catch (err) {
      console.error('LeBonCoin parse error:', err);
    }

    return items;
  }
}

// ===========================================
// eBay France Scraper
// ===========================================

class EbayFranceScraper extends BaseScraper {
  platform = 'ebay_fr';

  searchUrl(keyword: string): string {
    const params = new URLSearchParams({
      _nkw: keyword,
      _sacat: '67',  // Jewellery category
      LH_ItemCondition: '3000', // Used
      _sop: '15', // Sort: Time - newly listed
    });
    return `https://www.ebay.fr/sch/i.html?${params.toString()}`;
  }

  parseListings(html: string): ScrapedItem[] {
    const items: ScrapedItem[] = [];

    // Parse eBay's structured data
    const titleMatches = html.matchAll(/<h3[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/g);
    const priceMatches = html.matchAll(/class="s-item__price"[^>]*>([\s\S]*?)<\/span>/g);
    const linkMatches = html.matchAll(/class="s-item__link"[^>]*href="([^"]+)"/g);

    const titles = [...titleMatches].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    const prices = [...priceMatches].map(m => {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      const num = parseFloat(text.replace(/[^0-9,]/g, '').replace(',', '.'));
      return isNaN(num) ? null : num;
    });
    const links = [...linkMatches].map(m => m[1]);

    for (let i = 0; i < Math.min(titles.length, 20); i++) {
      if (!links[i] || titles[i]?.toLowerCase().includes('shop on ebay')) continue;

      items.push({
        source_url: links[i],
        source_platform: this.platform,
        title: titles[i] || '',
        description: '',
        price_eur: prices[i] || null,
        location: 'France',
        images: [],
        raw_data: {},
      });
    }

    return items;
  }
}

// ===========================================
// Collection Pipeline
// ===========================================

export class CollectionPipeline {
  private scrapers: BaseScraper[] = [
    new LeBonCoinScraper(),
    new EbayFranceScraper(),
  ];

  async runCollection(keywords: string[] = GOLD_KEYWORDS): Promise<number> {
    let totalCollected = 0;

    for (const keyword of keywords) {
      for (const scraper of this.scrapers) {
        const items = await scraper.scrapeKeyword(keyword);

        for (const item of items) {
          const saved = await this.saveItem(item);
          if (saved) totalCollected++;
        }

        // Rate limiting between requests
        await sleep(RATE_LIMIT_MS);
      }
    }

    console.log(`Collection complete: ${totalCollected} new listings saved`);
    return totalCollected;
  }

  private async saveItem(item: ScrapedItem): Promise<boolean> {
    const { error } = await supabase
      .from('scraped_listings')
      .upsert({
        source_url: item.source_url,
        source_platform: item.source_platform,
        title: item.title,
        description: item.description,
        price_eur: item.price_eur,
        location: item.location,
        images: item.images,
        raw_data: item.raw_data,
        processed: false,
      }, { onConflict: 'source_url', ignoreDuplicates: true });

    return !error;
  }

  // Process unanalyzed listings with AI valuation
  async processUnanalyzed(batchSize: number = 20): Promise<void> {
    const { data: unprocessed } = await supabase
      .from('scraped_listings')
      .select('*')
      .eq('processed', false)
      .limit(batchSize);

    if (!unprocessed?.length) return;

    // Import dynamically to avoid circular deps
    const { valuateGoldItem } = await import('@orflow/ai-valuation');
    const { fetchCurrentGoldPrice } = await import('@orflow/gold-pricing');
    const goldPrice = await fetchCurrentGoldPrice();

    for (const item of unprocessed) {
      try {
        const valuation = await valuateGoldItem({
          title: item.title,
          description: item.description,
          images: item.images?.slice(0, 2),
        });

        let arbitrageProfit = null;
        let isOpportunity = false;

        if (valuation.market_value_eur && item.price_eur) {
          const margin = ((valuation.market_value_eur - item.price_eur) / item.price_eur) * 100;
          if (margin >= 30) {
            isOpportunity = true;
            arbitrageProfit = valuation.market_value_eur - item.price_eur;
          }

          await supabase
            .from('scraped_listings')
            .update({
              estimated_gold_grams: valuation.estimated_weight_grams,
              estimated_purity: valuation.estimated_purity,
              market_value_eur: valuation.market_value_eur,
              arbitrage_profit_eur: arbitrageProfit,
              arbitrage_margin_pct: margin,
              is_opportunity: isOpportunity,
              processed: true,
            })
            .eq('id', item.id);
        } else {
          await supabase
            .from('scraped_listings')
            .update({ processed: true })
            .eq('id', item.id);
        }

        await sleep(300); // AI rate limiting
      } catch (err) {
        console.error(`Failed to process ${item.id}:`, err);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run as standalone service
if (require.main === module) {
  const pipeline = new CollectionPipeline();
  const RUN_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

  async function run() {
    console.log('Starting collection run...');
    await pipeline.runCollection();
    await pipeline.processUnanalyzed();
    console.log(`Next run in ${RUN_INTERVAL_MS / 60000} minutes`);
  }

  run();
  setInterval(run, RUN_INTERVAL_MS);
}
