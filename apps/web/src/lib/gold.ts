// Gold utilities for the web app
import { GoldPurity, GOLD_PURITY_FACTORS, GOLD_PURITY_LABELS } from '@orflow/types';

const TROY_OZ_IN_GRAMS = 31.1035;

export function calculateGoldValue(
  weightGrams: number,
  purity: GoldPurity,
  pricePerGramEur: number
): number {
  const purityFactor = GOLD_PURITY_FACTORS[purity];
  return Math.round(weightGrams * purityFactor * pricePerGramEur * 100) / 100;
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatGrams(grams: number): string {
  return `${grams.toFixed(2)}g`;
}

export function getPurityLabel(purity: GoldPurity): string {
  return GOLD_PURITY_LABELS[purity] || purity;
}

export async function fetchCurrentGoldPrice(): Promise<{ price_per_gram_eur: number; timestamp: string }> {
  try {
    const res = await fetch('/api/gold/price', { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('Failed to fetch price');
    return await res.json();
  } catch {
    return { price_per_gram_eur: 58.5, timestamp: new Date().toISOString() };
  }
}

export { GOLD_PURITY_LABELS, GOLD_PURITY_FACTORS };
export type { GoldPurity };
