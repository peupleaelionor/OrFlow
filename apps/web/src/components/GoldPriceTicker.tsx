'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function GoldPriceTicker() {
  const [price, setPrice] = useState<number>(58.5);
  const [prevPrice, setPrevPrice] = useState<number>(58.5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch('/api/gold/price');
        const data = await res.json();
        setPrevPrice(price);
        setPrice(data.price_per_gram_eur);
      } catch {
        // Keep current price
      } finally {
        setLoading(false);
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) return <span className="animate-pulse">chargement...</span>;

  const isUp = price >= prevPrice;
  const change = ((price - prevPrice) / prevPrice * 100).toFixed(2);

  return (
    <span className="flex items-center gap-1 font-bold">
      {price.toFixed(2)} €/g
      {isUp ? (
        <TrendingUp className="w-4 h-4 text-green-400" />
      ) : (
        <TrendingDown className="w-4 h-4 text-red-400" />
      )}
    </span>
  );
}
