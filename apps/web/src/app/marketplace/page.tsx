import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { formatEur, getPurityLabel } from '@/lib/gold';
import { MapPin, Filter, SlidersHorizontal } from 'lucide-react';
import type { Listing } from '@orflow/types';

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; purity?: string; min?: string; max?: string; type?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('listings')
    .select('*, seller:profiles(display_name, is_verified, is_professional, rating_as_seller)', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (params.city) query = query.ilike('location_city', `%${params.city}%`);
  if (params.purity) query = query.eq('gold_purity', params.purity);
  if (params.min) query = query.gte('asking_price_eur', parseFloat(params.min));
  if (params.max) query = query.lte('asking_price_eur', parseFloat(params.max));
  if (params.type) query = query.eq('item_type', params.type);
  if (params.q) query = query.textSearch('title', params.q, { config: 'french' });

  const { data: listings, count } = await query.limit(24);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Marketplace</h1>
          <p className="text-gray-500 mt-1">{count || 0} annonces d&apos;or recyclé</p>
        </div>
        <Link href="/sell" className="btn-gold text-sm">Vendre mon or</Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <form className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Recherche</label>
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Bague, collier, lingot..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ville</label>
            <input
              name="city"
              defaultValue={params.city}
              placeholder="Paris, Lyon..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-300"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Pureté</label>
            <select name="purity" defaultValue={params.purity} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-300">
              <option value="">Toutes</option>
              <option value="18k">18 carats</option>
              <option value="14k">14 carats</option>
              <option value="9k">9 carats</option>
              <option value="24k">24 carats</option>
              <option value="999">999‰</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Prix min (€)</label>
            <input name="min" type="number" defaultValue={params.min} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-gold-300" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Prix max (€)</label>
            <input name="max" type="number" defaultValue={params.max} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-gold-300" />
          </div>
          <button type="submit" className="btn-gold text-sm flex items-center gap-1">
            <Filter className="w-4 h-4" /> Filtrer
          </button>
        </form>
      </div>

      {/* Listings Grid */}
      {listings?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {listings.map((listing: Listing & { seller: { display_name: string; is_verified: boolean; is_professional: boolean; rating_as_seller: number } }) => (
            <Link key={listing.id} href={`/marketplace/${listing.id}`} className="card hover:shadow-md transition-shadow group">
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {listing.images[0] ? (
                  <Image src={listing.images[0]} alt={listing.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">💍</div>
                )}
                <div className="absolute top-2 left-2">
                  <span className="gold-badge">{getPurityLabel(listing.gold_purity)}</span>
                </div>
                {listing.allow_auction && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">Enchère</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 line-clamp-1 text-sm">{listing.title}</h3>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <MapPin className="w-3 h-3" />
                  <span>{listing.location_city || 'France'}</span>
                  <span className="mx-1">·</span>
                  <span>{listing.weight_grams}g</span>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-lg font-bold text-gold-700">
                      {listing.asking_price_eur ? formatEur(listing.asking_price_eur) : 'Faire offre'}
                    </p>
                    {listing.estimated_value_eur && (
                      <p className="text-xs text-gray-400">
                        Valeur: {formatEur(listing.estimated_value_eur)}
                      </p>
                    )}
                  </div>
                  {listing.seller?.is_verified && (
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">Aucun résultat</h3>
          <p className="text-gray-500">Modifiez vos filtres ou revenez plus tard.</p>
        </div>
      )}
    </div>
  );
}
