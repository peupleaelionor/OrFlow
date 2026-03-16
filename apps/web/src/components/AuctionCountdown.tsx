'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { formatEur } from '@/lib/gold';
import type { Auction } from '@orflow/types';
import { Zap, Users } from 'lucide-react';

function useCountdown(endsAt: string) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Terminée'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  return timeLeft;
}

function AuctionCard({ auction }: { auction: Auction & { listing: { images: string[] } } }) {
  const timeLeft = useCountdown(auction.ends_at);
  const isUrgent = new Date(auction.ends_at).getTime() - Date.now() < 3600000; // < 1 hour

  return (
    <Link href={`/auction/${auction.id}`} className="card hover:shadow-md transition-shadow group">
      <div className="aspect-video bg-gray-100 relative overflow-hidden">
        {auction.listing?.images?.[0] ? (
          <Image
            src={auction.listing.images[0]}
            alt={auction.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-gold-100 to-gold-200">
            🏆
          </div>
        )}

        {/* Live badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          LIVE
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{auction.title}</h3>

        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Enchère actuelle</p>
            <p className="text-xl font-bold text-gold-700">{formatEur(auction.current_price_eur)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Temps restant</p>
            <p className={`font-bold ${isUrgent ? 'countdown-urgent' : 'text-gray-900'}`}>
              {timeLeft}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4 text-gold-500" />
            <span>{auction.bids_count} enchères</span>
          </div>
          {auction.buy_now_price_eur && (
            <span className="text-green-600 font-medium">
              Achat immédiat: {formatEur(auction.buy_now_price_eur)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function AuctionCountdown() {
  const [auctions, setAuctions] = useState<(Auction & { listing: { images: string[] } })[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function fetchAuctions() {
      const { data } = await supabase
        .from('auctions')
        .select('*, listing:listings(images)')
        .eq('status', 'live')
        .order('ends_at', { ascending: true })
        .limit(4);
      setAuctions(data || []);
    }

    fetchAuctions();

    // Subscribe to auction updates
    const sub = supabase
      .channel('auctions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, fetchAuctions)
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, []);

  if (!auctions.length) {
    return (
      <div className="text-center py-8 text-gray-400">
        Aucune enchère en cours. <Link href="/auction" className="text-gold-600 underline">Voir les prochaines enchères</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {auctions.map(auction => (
        <AuctionCard key={auction.id} auction={auction} />
      ))}
    </div>
  );
}
