import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60; // cache 1 minute

export async function GET() {
  // Gracefully handle missing Supabase credentials
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({
      price_per_gram_eur: 58.5,
      price_per_troy_oz_usd: 2050,
      source: 'fallback',
      timestamp: new Date().toISOString(),
    });
  }

  const supabase = await createClient();

  // Try to get from DB cache first (updated by background job)
  const { data } = await supabase
    .from('gold_prices')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  if (data && new Date(data.timestamp).getTime() > Date.now() - 5 * 60 * 1000) {
    // Cache hit - less than 5 minutes old
    return NextResponse.json({
      price_per_gram_eur: data.price_per_gram_eur,
      price_per_troy_oz_usd: data.price_per_troy_oz_usd,
      source: data.source,
      timestamp: data.timestamp,
    });
  }

  // Fetch fresh price
  try {
    const apiKey = process.env.GOLD_API_KEY;
    if (apiKey) {
      const res = await fetch('https://www.goldapi.io/api/XAU/EUR', {
        headers: { 'x-access-token': apiKey },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const goldData = await res.json();
        const priceData = {
          price_per_gram_eur: goldData.price_gram_24k,
          price_per_troy_oz_usd: goldData.price,
          source: 'goldapi.io',
          timestamp: new Date().toISOString(),
        };

        // Save to DB
        await supabase.from('gold_prices').insert(priceData);

        return NextResponse.json(priceData);
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: use last known or default
  return NextResponse.json({
    price_per_gram_eur: data?.price_per_gram_eur || 58.5,
    price_per_troy_oz_usd: data?.price_per_troy_oz_usd || 2050,
    source: 'cached',
    timestamp: data?.timestamp || new Date().toISOString(),
  });
}
