import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatEur } from '@/lib/gold';
import { Package, TrendingUp, DollarSign, Star, Plus, Eye, Clock } from 'lucide-react';

export default async function SellerDashboard() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/dashboard/seller');

  const [
    { data: profile },
    { data: listings },
    { data: orders },
    { data: offers },
    { data: auctions },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('listings').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
    supabase.from('orders').select('*, buyer:profiles(display_name)').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('offers').select('*, buyer:profiles(display_name), listing:listings(title)').eq('seller_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('auctions').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(5),
  ]);

  const totalRevenue = orders?.filter(o => o.status === 'paid').reduce((sum: number, o) => sum + o.seller_payout_eur, 0) || 0;
  const activeListings = listings?.filter(l => l.status === 'active').length || 0;
  const pendingOffers = offers?.length || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Espace Vendeur</h1>
          <p className="text-gray-500">Bonjour, {profile?.display_name || profile?.full_name || 'Vendeur'}</p>
        </div>
        <Link href="/sell" className="btn-gold flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle annonce
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Revenu total', value: formatEur(totalRevenue), icon: DollarSign, color: 'text-green-600 bg-green-50' },
          { label: 'Annonces actives', value: activeListings, icon: Package, color: 'text-blue-600 bg-blue-50' },
          { label: 'Offres en attente', value: pendingOffers, icon: Clock, color: 'text-orange-600 bg-orange-50', alert: pendingOffers > 0 },
          { label: 'Note vendeur', value: profile?.rating_as_seller ? `${profile.rating_as_seller}/5` : 'N/A', icon: Star, color: 'text-gold-600 bg-gold-50' },
        ].map(({ label, value, icon: Icon, color, alert }) => (
          <div key={label} className={`card p-4 ${alert ? 'border-2 border-orange-200' : ''}`}>
            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Pending Offers */}
        {pendingOffers > 0 && (
          <div className="card p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Offres en attente ({pendingOffers})
            </h2>
            <div className="space-y-3">
              {offers?.map(offer => (
                <div key={offer.id} className="border border-orange-100 rounded-lg p-4 bg-orange-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{offer.listing?.title}</p>
                      <p className="text-sm text-gray-500">{offer.buyer?.display_name}</p>
                      {offer.message && <p className="text-sm text-gray-600 mt-1 italic">&ldquo;{offer.message}&rdquo;</p>}
                    </div>
                    <p className="text-xl font-bold text-gold-700">{formatEur(offer.amount_eur)}</p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <form action={`/api/offers/${offer.id}/accept`} method="POST">
                      <button className="bg-green-500 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-600">
                        Accepter
                      </button>
                    </form>
                    <form action={`/api/offers/${offer.id}/reject`} method="POST">
                      <button className="bg-gray-100 text-gray-700 text-sm px-4 py-1.5 rounded-lg hover:bg-gray-200">
                        Refuser
                      </button>
                    </form>
                    <Link href={`/offers/${offer.id}/counter`} className="bg-blue-100 text-blue-700 text-sm px-4 py-1.5 rounded-lg hover:bg-blue-200">
                      Contre-offre
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Listings */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            Mes annonces
          </h2>
          <div className="space-y-2">
            {listings?.slice(0, 6).map(listing => (
              <Link key={listing.id} href={`/marketplace/${listing.id}`} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div>
                  <p className="font-medium text-gray-900 line-clamp-1">{listing.title}</p>
                  <p className="text-sm text-gray-500">{listing.gold_purity} • {listing.weight_grams}g</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gold-700">{listing.asking_price_eur ? formatEur(listing.asking_price_eur) : '—'}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${listing.status === 'active' ? 'bg-green-100 text-green-700'
                    : listing.status === 'sold' ? 'bg-gray-100 text-gray-600'
                    : 'bg-yellow-100 text-yellow-700'}`}>
                    {listing.status === 'active' ? 'Active' : listing.status === 'sold' ? 'Vendue' : listing.status}
                  </span>
                </div>
              </Link>
            ))}
            {!listings?.length && (
              <div className="text-center py-8 text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucune annonce</p>
                <Link href="/sell" className="text-gold-600 text-sm font-medium mt-2 block">Créer ma première annonce →</Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Ventes récentes
          </h2>
          <div className="space-y-2">
            {orders?.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{order.buyer?.display_name}</p>
                  <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-700">{formatEur(order.seller_payout_eur)}</p>
                  <span className={`text-xs ${order.status === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
                    {order.status === 'paid' ? '✓ Payé' : order.status}
                  </span>
                </div>
              </div>
            ))}
            {!orders?.length && (
              <p className="text-center text-gray-400 py-4">Aucune vente</p>
            )}
          </div>
        </div>

        {/* My Auctions */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4">Mes enchères</h2>
          <div className="space-y-2">
            {auctions?.map(auction => (
              <Link key={auction.id} href={`/auction/${auction.id}`} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium line-clamp-1">{auction.title}</p>
                  <p className="text-sm text-gray-500">{auction.bids_count} enchères</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gold-700">{formatEur(auction.current_price_eur)}</p>
                  <span className={`text-xs ${auction.status === 'live' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                    {auction.status === 'live' ? '● LIVE' : auction.status}
                  </span>
                </div>
              </Link>
            ))}
            {!auctions?.length && (
              <div className="text-center py-4 text-gray-400">
                <Link href="/auction/create" className="text-gold-600 text-sm font-medium">Créer une enchère →</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
