import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatEur } from '@/lib/gold';
import Link from 'next/link';
import { Users, Package, Gavel, TrendingUp, AlertTriangle, DollarSign, Search, Zap } from 'lucide-react';

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');

  // Fetch platform stats
  const [
    { count: totalUsers },
    { count: totalListings },
    { count: activeListings },
    { count: pendingReview },
    { count: totalAuctions },
    { count: liveAuctions },
    { count: totalOrders },
    { data: recentOrders },
    { data: pendingListings },
    { data: opportunities },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('auctions').select('*', { count: 'exact', head: true }),
    supabase.from('auctions').select('*', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*, buyer:profiles(display_name), seller:profiles(display_name)').order('created_at', { ascending: false }).limit(10),
    supabase.from('listings').select('*, seller:profiles(display_name, email)').eq('status', 'pending_review').order('created_at', { ascending: false }).limit(10),
    supabase.from('scraped_listings').select('*').eq('is_opportunity', true).order('arbitrage_margin_pct', { ascending: false }).limit(8),
  ]);

  // Revenue calculation
  const { data: paidOrders } = await supabase
    .from('orders')
    .select('platform_fee_eur')
    .eq('status', 'paid');

  const totalRevenue = paidOrders?.reduce((sum, o) => sum + o.platform_fee_eur, 0) || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Admin OrFlow</h1>
          <p className="text-gray-500">Tableau de bord plateforme</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/scraper" className="btn-outline-gold text-sm flex items-center gap-1">
            <Search className="w-4 h-4" />
            Scraper
          </Link>
          <Link href="/admin/auctions" className="btn-gold text-sm flex items-center gap-1">
            <Zap className="w-4 h-4" />
            Créer enchère
          </Link>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Utilisateurs', value: totalUsers || 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
          { label: 'Annonces actives', value: activeListings || 0, icon: Package, color: 'text-green-600 bg-green-50' },
          { label: 'Enchères live', value: liveAuctions || 0, icon: Gavel, color: 'text-red-600 bg-red-50', alert: (liveAuctions || 0) > 0 },
          { label: 'Revenu platform', value: formatEur(totalRevenue), icon: DollarSign, color: 'text-gold-600 bg-gold-50' },
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

      {/* Secondary stats */}
      <div className="grid grid-cols-4 gap-4 mb-8 text-center">
        {[
          { label: 'Total annonces', value: totalListings || 0 },
          { label: 'En attente de validation', value: pendingReview || 0, alert: (pendingReview || 0) > 0 },
          { label: 'Total enchères', value: totalAuctions || 0 },
          { label: 'Total commandes', value: totalOrders || 0 },
        ].map(({ label, value, alert }) => (
          <div key={label} className={`card p-3 ${alert ? 'border border-orange-300 bg-orange-50' : ''}`}>
            <p className={`text-xl font-bold ${alert ? 'text-orange-700' : 'text-gray-900'}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Listings pending review */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Annonces à valider ({pendingReview || 0})
          </h2>
          <div className="space-y-2">
            {pendingListings?.map(listing => (
              <div key={listing.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{listing.title}</p>
                  <p className="text-xs text-gray-500">{listing.seller?.display_name} • {listing.gold_purity} • {listing.weight_grams}g</p>
                </div>
                <div className="flex gap-2">
                  <form action={`/api/admin/listings/${listing.id}/approve`} method="POST">
                    <button className="bg-green-500 text-white text-xs px-3 py-1 rounded hover:bg-green-600">
                      ✓ Valider
                    </button>
                  </form>
                  <form action={`/api/admin/listings/${listing.id}/reject`} method="POST">
                    <button className="bg-red-500 text-white text-xs px-3 py-1 rounded hover:bg-red-600">
                      ✗ Rejeter
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {!pendingListings?.length && (
              <p className="text-center text-gray-400 py-4 text-sm">Tout est validé ✓</p>
            )}
          </div>
        </div>

        {/* Arbitrage Dashboard */}
        <div className="card p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Top opportunités arbitrage
          </h2>
          <div className="space-y-2">
            {opportunities?.map(item => (
              <a key={item.id} href={item.source_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                <div>
                  <p className="font-medium text-xs line-clamp-1">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.source_platform}</p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-xs font-bold text-green-700">+{item.arbitrage_margin_pct?.toFixed(0)}%</p>
                  <p className="text-xs">{item.price_eur ? formatEur(item.price_eur) : '—'}</p>
                </div>
              </a>
            ))}
          </div>
          <Link href="/admin/arbitrage" className="text-gold-600 text-sm font-medium mt-3 block text-right">
            Voir toutes les opportunités →
          </Link>
        </div>

        {/* Recent Orders */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-bold text-gray-900 mb-4">Commandes récentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-2 text-gray-500 font-medium">ID</th>
                  <th className="pb-2 text-gray-500 font-medium">Acheteur</th>
                  <th className="pb-2 text-gray-500 font-medium">Vendeur</th>
                  <th className="pb-2 text-gray-500 font-medium">Montant</th>
                  <th className="pb-2 text-gray-500 font-medium">Commission</th>
                  <th className="pb-2 text-gray-500 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders?.map(order => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 text-gray-400 font-mono text-xs">{order.id.slice(0, 8)}</td>
                    <td className="py-2">{order.buyer?.display_name}</td>
                    <td className="py-2">{order.seller?.display_name}</td>
                    <td className="py-2 font-bold">{formatEur(order.amount_eur)}</td>
                    <td className="py-2 text-green-600">{formatEur(order.platform_fee_eur)}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${order.status === 'paid' ? 'bg-green-100 text-green-700'
                        : order.status === 'delivered' ? 'bg-blue-100 text-blue-700'
                        : 'bg-yellow-100 text-yellow-700'}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
