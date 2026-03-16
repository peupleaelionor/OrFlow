import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { formatEur } from '@/lib/gold';
import { Clock, Zap, ArrowRight } from 'lucide-react';
import type { Auction } from '@orflow/types';

export default async function AuctionsPage() {
  const supabase = await createClient();

  const [{ data: liveAuctions }, { data: scheduledAuctions }, { data: endedAuctions }] = await Promise.all([
    supabase
      .from('auctions')
      .select('*, listing:listings(images, item_type, gold_purity, weight_grams), seller:profiles(display_name)')
      .eq('status', 'live')
      .order('ends_at', { ascending: true }),
    supabase
      .from('auctions')
      .select('*, listing:listings(images, item_type, gold_purity), seller:profiles(display_name)')
      .eq('status', 'scheduled')
      .order('starts_at', { ascending: true })
      .limit(6),
    supabase
      .from('auctions')
      .select('*, listing:listings(images, item_type), winner:profiles(display_name)')
      .eq('status', 'ended')
      .order('updated_at', { ascending: false })
      .limit(6),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl font-bold text-gray-900">Enchères or</h1>
          <p className="text-gray-500 mt-1">Participez aux ventes aux enchères en temps réel</p>
        </div>
        <Link href="/auction/create" className="btn-gold flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Créer une enchère
        </Link>
      </div>

      {/* Live Auctions */}
      {liveAuctions && liveAuctions.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            En cours ({liveAuctions.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveAuctions.map((auction: Auction & { listing: { images: string[] } }) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        </section>
      )}

      {/* Scheduled */}
      {scheduledAuctions && scheduledAuctions.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-500" />
            Prochaines enchères
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {scheduledAuctions.map((auction: Auction & { listing: { images: string[] } }) => (
              <AuctionCard key={auction.id} auction={auction} scheduled />
            ))}
          </div>
        </section>
      )}

      {/* Recently Ended */}
      {endedAuctions && endedAuctions.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Enchères terminées</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
            {endedAuctions.map((auction: Auction & { listing: { images: string[] } }) => (
              <AuctionCard key={auction.id} auction={auction} ended />
            ))}
          </div>
        </section>
      )}

      {!liveAuctions?.length && !scheduledAuctions?.length && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔨</div>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Aucune enchère pour l&apos;instant</h2>
          <p className="text-gray-500 mb-6">Soyez le premier à créer une enchère !</p>
          <Link href="/auction/create" className="btn-gold">Créer une enchère</Link>
        </div>
      )}
    </div>
  );
}

function AuctionCard({
  auction,
  scheduled = false,
  ended = false,
}: {
  auction: Auction & { listing: { images: string[] } };
  scheduled?: boolean;
  ended?: boolean;
}) {
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
        <div className={`absolute top-2 left-2 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1
          ${ended ? 'bg-gray-500' : scheduled ? 'bg-blue-500' : 'bg-red-500'}`}>
          {!scheduled && !ended && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
          {ended ? 'TERMINÉE' : scheduled ? 'À VENIR' : 'LIVE'}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{auction.title}</h3>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{ended ? 'Prix final' : 'Enchère actuelle'}</p>
            <p className="text-xl font-bold text-gold-700">{formatEur(auction.current_price_eur)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{auction.bids_count} enchères</p>
            <p className="text-sm font-medium text-gray-700">
              {scheduled
                ? new Date(auction.starts_at).toLocaleDateString('fr-FR')
                : ended
                  ? 'Terminée'
                  : <span className="text-red-600">En cours</span>}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center text-gold-600 text-sm font-medium">
          <span>{ended ? 'Voir les détails' : scheduled ? 'S\'inscrire' : 'Enchérir maintenant'}</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      </div>
    </Link>
  );
}
