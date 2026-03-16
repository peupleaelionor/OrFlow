import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Eye } from 'lucide-react';
import { formatEur, getPurityLabel } from '@/lib/gold';
import type { Listing } from '@orflow/types';

export default async function FeaturedListings() {
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from('listings')
    .select('*, seller:profiles(display_name, is_verified, is_professional)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(8);

  if (!listings?.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        Aucune annonce disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {listings.map((listing: Listing & { seller: { display_name: string; is_verified: boolean; is_professional: boolean } }) => (
        <Link key={listing.id} href={`/marketplace/${listing.id}`} className="card hover:shadow-md transition-shadow group">
          {/* Image */}
          <div className="aspect-square bg-gray-100 relative overflow-hidden">
            {listing.images[0] ? (
              <Image
                src={listing.images[0]}
                alt={listing.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">
                💍
              </div>
            )}
            <div className="absolute top-2 left-2">
              <span className="gold-badge">{getPurityLabel(listing.gold_purity)}</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{listing.title}</h3>

            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{listing.location_city || 'France'}</span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-gold-700">
                  {listing.asking_price_eur ? formatEur(listing.asking_price_eur) : 'Prix sur offre'}
                </p>
                {listing.estimated_value_eur && (
                  <p className="text-xs text-gray-400">
                    Valeur estimée: {formatEur(listing.estimated_value_eur)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Eye className="w-3.5 h-3.5" />
                {listing.views_count}
              </div>
            </div>

            {/* Seller info */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {listing.seller?.display_name || 'Vendeur'}
              </span>
              {listing.seller?.is_verified && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">✓ Vérifié</span>
              )}
              {listing.seller?.is_professional && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Pro</span>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
