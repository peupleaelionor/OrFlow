export function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatGrams(grams: number): string {
  return `${grams.toFixed(2)}g`;
}
