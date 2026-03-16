// ===========================================
// ORFLOW - AI Valuation Engine
// Uses Claude AI to estimate gold item value
// from photos, descriptions, and weight
// ===========================================

import Anthropic from '@anthropic-ai/sdk';
import { GoldPurity, GOLD_PURITY_FACTORS } from '@orflow/types';
import { calculateGoldValue, fetchCurrentGoldPrice } from '@orflow/gold-pricing';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ValuationInput {
  title?: string;
  description?: string;
  weight_grams?: number;
  declared_purity?: GoldPurity;
  images?: string[]; // base64 or URLs
  location_city?: string;
}

export interface ValuationResult {
  estimated_weight_grams: number | null;
  confidence_weight: number; // 0-1
  estimated_purity: GoldPurity | null;
  confidence_purity: number; // 0-1
  market_value_eur: number | null;
  recommended_price_eur: number | null;
  arbitrage_opportunity: boolean;
  arbitrage_profit_eur: number | null;
  reasoning: string;
  warnings: string[];
}

export async function valuateGoldItem(input: ValuationInput): Promise<ValuationResult> {
  const currentPrice = await fetchCurrentGoldPrice();
  const pricePerGram = currentPrice.pricePerGramEur;

  // Build the prompt for Claude
  const systemPrompt = `Tu es un expert en évaluation d'or recyclé et de bijouterie pour la plateforme OrFlow.
Tu dois analyser des bijoux et objets en or pour estimer leur valeur marchande.

Contexte marché:
- Prix spot de l'or 24k aujourd'hui: ${pricePerGram.toFixed(2)} EUR/gramme
- Un bijou 18k contient 75% d'or pur
- Un bijou 14k contient 58.5% d'or pur
- Les bijoux anciens peuvent avoir une valeur numismatique supplémentaire

Tu dois retourner une analyse JSON avec les champs suivants:
{
  "estimated_weight_grams": number | null,
  "confidence_weight": number (0-1),
  "estimated_purity": "8k"|"9k"|"10k"|"14k"|"18k"|"21k"|"22k"|"24k"|"999"|"995"|"unknown" | null,
  "confidence_purity": number (0-1),
  "market_value_eur": number | null,
  "recommended_price_eur": number | null,
  "reasoning": string,
  "warnings": string[]
}`;

  const userMessage = buildValuationPrompt(input, pricePerGram);

  try {
    const messages: Anthropic.MessageParam[] = [];

    // Add image content if available
    if (input.images?.length) {
      const imageContents: Anthropic.ContentBlockParam[] = [];

      for (const imageUrl of input.images.slice(0, 3)) { // max 3 images
        if (imageUrl.startsWith('data:')) {
          const [header, data] = imageUrl.split(',');
          const mediaType = header.split(';')[0].split(':')[1] as 'image/jpeg' | 'image/png' | 'image/webp';
          imageContents.push({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data },
          });
        } else {
          imageContents.push({
            type: 'image',
            source: { type: 'url', url: imageUrl },
          });
        }
      }

      imageContents.push({ type: 'text', text: userMessage });
      messages.push({ role: 'user', content: imageContents });
    } else {
      messages.push({ role: 'user', content: userMessage });
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Calculate market value if we have weight and purity
    let marketValue = parsed.market_value_eur;
    if (!marketValue && parsed.estimated_weight_grams && parsed.estimated_purity) {
      const valuation = calculateGoldValue(
        parsed.estimated_weight_grams,
        parsed.estimated_purity,
        pricePerGram
      );
      marketValue = valuation.market_value_eur;
      parsed.recommended_price_eur = valuation.recommended_price_eur;
    }

    // Arbitrage detection
    let arbitrageProfit = null;
    let isArbitrageOpportunity = false;

    if (marketValue && input.description) {
      // Try to extract listed price from description
      const priceMatch = input.description.match(/(\d+(?:[.,]\d+)?)\s*(?:€|EUR|eur)/i);
      if (priceMatch) {
        const listedPrice = parseFloat(priceMatch[1].replace(',', '.'));
        const margin = ((marketValue - listedPrice) / listedPrice) * 100;
        if (margin >= 30) {
          isArbitrageOpportunity = true;
          arbitrageProfit = marketValue - listedPrice;
        }
      }
    }

    return {
      estimated_weight_grams: parsed.estimated_weight_grams || null,
      confidence_weight: parsed.confidence_weight || 0,
      estimated_purity: parsed.estimated_purity || null,
      confidence_purity: parsed.confidence_purity || 0,
      market_value_eur: marketValue || null,
      recommended_price_eur: parsed.recommended_price_eur || null,
      arbitrage_opportunity: isArbitrageOpportunity,
      arbitrage_profit_eur: arbitrageProfit,
      reasoning: parsed.reasoning || '',
      warnings: parsed.warnings || [],
    };
  } catch (err) {
    console.error('AI Valuation error:', err);

    // Fallback: use declared values if available
    if (input.weight_grams && input.declared_purity) {
      const valuation = calculateGoldValue(input.weight_grams, input.declared_purity, pricePerGram);
      return {
        estimated_weight_grams: input.weight_grams,
        confidence_weight: 1.0,
        estimated_purity: input.declared_purity,
        confidence_purity: 1.0,
        market_value_eur: valuation.market_value_eur,
        recommended_price_eur: valuation.recommended_price_eur,
        arbitrage_opportunity: false,
        arbitrage_profit_eur: null,
        reasoning: 'Valorisation basée sur les données déclarées (poids + pureté)',
        warnings: ['Analyse IA indisponible - valeurs déclarées utilisées'],
      };
    }

    return {
      estimated_weight_grams: null,
      confidence_weight: 0,
      estimated_purity: null,
      confidence_purity: 0,
      market_value_eur: null,
      recommended_price_eur: null,
      arbitrage_opportunity: false,
      arbitrage_profit_eur: null,
      reasoning: 'Impossible d\'évaluer sans données suffisantes',
      warnings: ['Analyse IA indisponible', 'Données insuffisantes pour l\'évaluation'],
    };
  }
}

function buildValuationPrompt(input: ValuationInput, pricePerGram: number): string {
  const parts = ['Analyse et évalue cet objet en or:'];

  if (input.title) parts.push(`Titre: ${input.title}`);
  if (input.description) parts.push(`Description: ${input.description}`);
  if (input.weight_grams) parts.push(`Poids déclaré: ${input.weight_grams}g`);
  if (input.declared_purity) parts.push(`Pureté déclarée: ${input.declared_purity}`);
  if (input.location_city) parts.push(`Ville: ${input.location_city}`);

  parts.push(`\nPrix de l'or aujourd'hui: ${pricePerGram.toFixed(2)} EUR/g (24k)`);

  if (input.images?.length) {
    parts.push('\nAnalyse les images fournies pour estimer:');
    parts.push('- Le type d\'objet et son état');
    parts.push('- Le poids approximatif basé sur la taille visible');
    parts.push('- La pureté probable');
  }

  parts.push('\nRetourne uniquement le JSON demandé, sans texte autour.');

  return parts.join('\n');
}

// Batch valuation for scraped listings
export async function batchValuateListings(listings: ValuationInput[]): Promise<ValuationResult[]> {
  const results: ValuationResult[] = [];
  for (const listing of listings) {
    const result = await valuateGoldItem(listing);
    results.push(result);
    // Rate limiting: wait 200ms between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return results;
}
