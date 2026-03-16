import { NextRequest, NextResponse } from 'next/server';
import { GOLD_PURITY_FACTORS } from '@orflow/types';
import type { GoldPurity } from '@orflow/types';

const TROY_OZ_IN_GRAMS = 31.1035;
const BUYER_RATE = 0.85;
const REFINERY_RATE = 0.96;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const weightGrams = parseFloat(formData.get('weight_grams') as string);
    const purity = formData.get('purity') as GoldPurity;
    const description = formData.get('description') as string | null;

    if (isNaN(weightGrams) || weightGrams <= 0) {
      return NextResponse.json({ error: 'Invalid weight' }, { status: 400 });
    }

    // Get current gold price
    const priceRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/gold/price`);
    const priceData = await priceRes.json();
    const pricePerGram: number = priceData.price_per_gram_eur || 58.5;

    const purityFactor = GOLD_PURITY_FACTORS[purity] || 0.5;
    const fineGoldGrams = weightGrams * purityFactor;
    const marketValue = fineGoldGrams * pricePerGram;

    // Optional: use AI for image analysis
    let reasoning = `Calcul basé sur ${weightGrams}g d'or ${purity} au prix spot de ${pricePerGram.toFixed(2)} €/g`;
    const images = formData.getAll('images') as File[];

    if (images.length > 0 && process.env.ANTHROPIC_API_KEY) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic();

        const imageContents = await Promise.all(
          images.slice(0, 2).map(async (img) => {
            const buffer = await img.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: img.type as 'image/jpeg' | 'image/png' | 'image/webp',
                data: base64,
              },
            };
          })
        );

        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: [
              ...imageContents,
              {
                type: 'text',
                text: `C'est un objet en or ${purity} de ${weightGrams}g. Décris brièvement ce que tu vois et confirme si le poids et la pureté paraissent plausibles. Réponds en 2-3 phrases maximum en français.`,
              },
            ],
          }],
        });

        const aiText = response.content[0].type === 'text' ? response.content[0].text : '';
        if (aiText) reasoning = aiText;
      } catch {
        // AI analysis failed, use default reasoning
      }
    }

    return NextResponse.json({
      weight_grams: weightGrams,
      purity,
      purity_factor: purityFactor,
      fine_gold_grams: fineGoldGrams,
      price_per_gram_eur: pricePerGram,
      market_value_eur: Math.round(marketValue * 100) / 100,
      recommended_price_eur: Math.round(marketValue * BUYER_RATE * 100) / 100,
      refinery_payout_eur: Math.round(marketValue * REFINERY_RATE * 100) / 100,
      reasoning,
    });
  } catch (err) {
    console.error('Estimation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
