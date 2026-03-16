import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatEur } from '@/lib/gold';
import { ShoppingBag, Zap, Heart, TrendingUp, Search } from 'lucide-react';

export default async function BuyerDashboard() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/dashboard/buyer');

  const [
    { data: profile },
    { data: orders },
    { data: offers },
    { data: bids },
    { data: opportunities },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('orders').select('*, listing:listings(title, images, gold_purity, weight_grams)').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('offers').select('*, listing:listings(title, images, asking_price_eur)').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('bids').select('*, auction:auctions(title, current_price_eur, status, ends_at)').eq('bidder_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(5),
    supabase.from('scraped_listings').select('*').eq('is_opportunity', true).order('arbitrage_margin_pct', { ascending: false }).limit(6),
  ]);

  const totalSpent = orders?.filter(o => o.status === 'paid').reduce((sum: number, o) => sum + o.amount_eur, 0) || 0;
  const activeBids = bids?.length || 0;
  const pendingOffers = offers?.filter(o => ['pending', 'countered'].includes(o.status)).length || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Espace Acheteur</h1>
          <p className="text-gray-500">Bonjour, {profile?.display_name || profile?.full_name || 'Acheteur'}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/marketplace" className="btn-outline-gold flex items-center gap-2">
            <Search className="w-4 h-4" />
            Chercher de l&apos;or
          </Link>
          <Link href="/auction" className="btn-gold flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Enchères live
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total dépensé', value: formatEur(totalSpent), icon: ShoppingBag, color: 'text-blue-600 bg-blue-50' },
          { label: 'Enchères actives', value: activeBids, icon: Zap, color: 'text-red-600 bg-red-50', alert: activeBids > 0 },
          { label: 'Offres en cours', value: pendingOffers, icon: Heart, color: 'text-pink-600 bg-pink-50' },
          { label: 'Achats totaux', value: profile?.total_purchases || 0, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
        ].map(({ label, value, icon: Icon, color, alert }) => (
          <div key={label} className={`card p-4 ${alert ? 'border-2 border-red-200' : ''}`}>
            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Active Bids */}
        {activeBids > 0 && (
          <div className="card p-6 border-2 border-red-100">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Mes enchères en cours ({activeBids})
            </h2>
            <div className="space-y-3">
              {bids?.map(bid => (
                <Link key={bid.id} href={`/auction/${bid.auction?.id}`}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                  <div>
                    <p className="font-semibold text-gray-900">{bid.auction?.title}</p>
                    <p className="text-sm text-gray-500">
                      Prix actuel: <span className="font-bold text-gold-700">{formatEur(bid.auction?.current_price_eur)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatEur(bid.amount_eur)}</p>
                    <p className="text-xs text-red-600 font-medium">Ma mise</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Arbitrage Opportunities */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Opportunités d&apos;arbitrage
          </h2>
          <p className="text-sm text-gray-500 mb-4">Annonces avec marge supérieure à 30%</p>
          <div className="space-y-3">
            {opportunities?.map(item => (
              <a key={item.id} href={item.source_url} target="_blank" rel="noopener noreferrer"
                className="block p-3 border border-green-100 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 line-clamp-1 text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.source_platform} • {item.location}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-bold text-gray-900">{formatEur(item.price_eur)}</p>
                    <p className="text-xs text-green-700 font-bold">+{item.arbitrage_margin_pct?.toFixed(0)}%</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Valeur: {item.market_value_eur ? formatEur(item.market_value_eur) : '—'}</span>
                  <span className="text-green-700 font-medium">Profit: {item.arbitrage_profit_eur ? formatEur(item.arbitrage_profit_eur) : '—'}</span>
                </div>
              </a>
            ))}
            {!opportunities?.length && (
              <p className="text-center text-gray-400 py-4 text-sm">
                Aucune opportunité détectée pour le moment.<br />
                Notre moteur analyse les annonces en continu.
              </p>
            )}
          </div>
        </div>

        {/* My Offers */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4">Mes offres</h2>
          <div className="space-y-2">
            {offers?.map(offer => (
              <Link key={offer.id} href={`/marketplace/${offer.listing_id}`}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-sm">{offer.listing?.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full
                    ${offer.status === 'accepted' ? 'bg-green-100 text-green-700'
                    : offer.status === 'rejected' ? 'bg-red-100 text-red-700'
                    : offer.status === 'countered' ? 'bg-blue-100 text-blue-700'
                    : 'bg-yellow-100 text-yellow-700'}`}>
                    {offer.status === 'accepted' ? '✓ Acceptée'
                    : offer.status === 'rejected' ? '✗ Refusée'
                    : offer.status === 'countered' ? 'Contre-offre !'
                    : 'En attente'}
                  </span>
                </div>
                <p className="font-bold text-gold-700">{formatEur(offer.amount_eur)}</p>
              </Link>
            ))}
            {!offers?.length && <p className="text-center text-gray-400 py-4 text-sm">Aucune offre envoyée</p>}
          </div>
        </div>

        {/* Purchase History */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4">Historique des achats</h2>
          <div className="space-y-2">
            {orders?.map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-sm">{order.listing?.title}</p>
                  <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatEur(order.amount_eur)}</p>
                  <span className={`text-xs ${order.status === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
                    {order.status === 'delivered' ? '✓ Reçu' : order.status === 'paid' ? '📦 En cours' : order.status}
                  </span>
                </div>
              </div>
            ))}
            {!orders?.length && <p className="text-center text-gray-400 py-4 text-sm">Aucun achat</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
