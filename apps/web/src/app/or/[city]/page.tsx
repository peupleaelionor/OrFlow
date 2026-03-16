import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { formatEur } from '@/lib/gold';
import { FRENCH_MARKET_PRICES } from '@orflow/gold-pricing';
import { MapPin, TrendingUp, ArrowRight, Star } from 'lucide-react';

const CITY_SLUGS: Record<string, string> = {
  'paris': 'Paris',
  'lyon': 'Lyon',
  'marseille': 'Marseille',
  'toulouse': 'Toulouse',
  'bordeaux': 'Bordeaux',
  'nantes': 'Nantes',
  'strasbourg': 'Strasbourg',
  'lille': 'Lille',
  'rennes': 'Rennes',
  'montpellier': 'Montpellier',
  'nice': 'Nice',
  'grenoble': 'Grenoble',
};

export async function generateStaticParams() {
  return Object.keys(CITY_SLUGS).map(city => ({ city }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const cityName = CITY_SLUGS[city.toLowerCase()];
  if (!cityName) return {};

  return {
    title: `Prix de l'or à ${cityName} - Vendre votre or | OrFlow`,
    description: `Découvrez le prix de l'or à ${cityName} aujourd'hui. Estimation gratuite de vos bijoux en or. Vendez votre or au meilleur prix à ${cityName} sur OrFlow.`,
    keywords: [`prix or ${cityName}`, `vendre or ${cityName}`, `bijoux or ${cityName}`, `racheter or ${cityName}`],
  };
}

export default async function CityGoldPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const cityName = CITY_SLUGS[city.toLowerCase()];
  if (!cityName) notFound();

  const supabase = await createClient();
  const regionalData = FRENCH_MARKET_PRICES.find(p => p.city.toLowerCase() === cityName.toLowerCase());

  // Get current gold price
  const { data: goldPrice } = await supabase
    .from('gold_prices')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  const pricePerGram = goldPrice?.price_per_gram_eur || 58.5;

  // Get local listings
  const { data: localListings } = await supabase
    .from('listings')
    .select('*, seller:profiles(display_name, is_verified)')
    .eq('status', 'active')
    .ilike('location_city', `%${cityName}%`)
    .order('created_at', { ascending: false })
    .limit(6);

  // Calculate values for common items
  const examples = [
    { label: 'Alliance 18k (4g)', grams: 4, purity: 0.75 },
    { label: 'Bracelet 18k (10g)', grams: 10, purity: 0.75 },
    { label: 'Collier 18k (15g)', grams: 15, purity: 0.75 },
    { label: 'Bague 14k (5g)', grams: 5, purity: 0.585 },
    { label: 'Pièce 20F Napoléon', grams: 6.45, purity: 0.9 },
    { label: 'Lingot 10g (999‰)', grams: 10, purity: 0.999 },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-gold-100 text-gold-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
          <MapPin className="w-4 h-4" />
          {cityName}
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          Prix de l&apos;or à {cityName}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Cours de l&apos;or en temps réel et estimation gratuite de vos bijoux.
          Vendez votre or au meilleur prix à {cityName}.
        </p>

        {/* Live Price */}
        <div className="mt-8 inline-block bg-gradient-to-r from-gold-600 to-gold-800 text-white rounded-2xl px-8 py-6">
          <p className="text-sm font-medium opacity-80 mb-1">Or 24 carats (999‰) — en direct</p>
          <p className="text-5xl font-display font-bold">{pricePerGram.toFixed(2)} €/g</p>
          <p className="text-sm opacity-70 mt-1">Mis à jour: {new Date().toLocaleTimeString('fr-FR')}</p>
        </div>
      </div>

      {/* Local Market Data */}
      {regionalData && (
        <div className="card p-6 mb-8">
          <h2 className="font-bold text-xl text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-500" />
            Marché de l&apos;or à {cityName}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">Rachat bijouterie</p>
              <p className="text-2xl font-bold text-red-600">{regionalData.average_buy_price_per_gram.toFixed(2)} €/g</p>
              <p className="text-xs text-gray-400 mt-1">Ce que les bijoutiers paient</p>
            </div>
            <div className="text-center p-4 bg-gold-50 rounded-xl border-2 border-gold-200">
              <p className="text-sm text-gold-700 mb-1 font-medium">OrFlow — Meilleur prix</p>
              <p className="text-2xl font-bold text-gold-700">{(pricePerGram * 0.85).toFixed(2)} €/g</p>
              <p className="text-xs text-gold-600 mt-1">85% du prix spot</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">Vente bijouterie</p>
              <p className="text-2xl font-bold text-gray-700">{regionalData.average_sell_price_per_gram.toFixed(2)} €/g</p>
              <p className="text-xs text-gray-400 mt-1">Ce que les bijoutiers demandent</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-700">
            <strong>Économie OrFlow:</strong> En vendant sur OrFlow plutôt qu&apos;à une bijouterie, vous gagnez en moyenne{' '}
            {(((pricePerGram * 0.85) - regionalData.average_buy_price_per_gram) / regionalData.average_buy_price_per_gram * 100).toFixed(0)}% de plus sur votre vente.
          </div>
        </div>
      )}

      {/* Price Examples Table */}
      <div className="card p-6 mb-8">
        <h2 className="font-bold text-xl text-gray-900 mb-4">
          Combien vaut votre or à {cityName} ?
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-600 font-medium">Objet</th>
                <th className="text-right py-2 text-gray-600 font-medium">Valeur spot</th>
                <th className="text-right py-2 text-gold-700 font-medium">OrFlow</th>
                <th className="text-right py-2 text-gray-600 font-medium">Bijouterie</th>
              </tr>
            </thead>
            <tbody>
              {examples.map(ex => {
                const spotValue = ex.grams * ex.purity * pricePerGram;
                return (
                  <tr key={ex.label} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{ex.label}</td>
                    <td className="py-3 text-right text-gray-600">{formatEur(spotValue)}</td>
                    <td className="py-3 text-right font-bold text-gold-700">{formatEur(spotValue * 0.85)}</td>
                    <td className="py-3 text-right text-red-500">{formatEur(spotValue * 0.65)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Local Listings */}
      {localListings && localListings.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold text-xl text-gray-900 mb-4">
            Annonces d&apos;or à {cityName}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {localListings.slice(0, 4).map(listing => (
              <Link key={listing.id} href={`/marketplace/${listing.id}`} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm line-clamp-2">{listing.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{listing.gold_purity} • {listing.weight_grams}g</p>
                    {listing.seller?.is_verified && <span className="text-xs text-green-600">✓ Vérifié</span>}
                  </div>
                  <p className="font-bold text-gold-700 text-sm ml-2 whitespace-nowrap">
                    {listing.asking_price_eur ? formatEur(listing.asking_price_eur) : 'Offre'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Link href={`/marketplace?city=${cityName}`} className="text-gold-600 text-sm font-medium flex items-center gap-1 mt-3">
            Voir toutes les annonces à {cityName} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* CTA */}
      <div className="bg-gradient-to-r from-gold-600 to-gold-800 rounded-2xl p-8 text-white text-center">
        <h2 className="font-display text-3xl font-bold mb-3">
          Vendez votre or à {cityName}
        </h2>
        <p className="text-gold-100 mb-6 text-lg">
          Obtenez une estimation gratuite et vendez au meilleur prix
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/estimation" className="bg-white text-gold-800 font-bold px-6 py-3 rounded-xl hover:bg-gold-50 transition-colors">
            Estimer gratuitement
          </Link>
          <Link href="/sell" className="border-2 border-white text-white font-bold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors">
            Mettre en vente
          </Link>
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gold-100">
          <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-gold-300 text-gold-300" /> 4.8/5 (200+ avis)</span>
          <span>✓ 0% commission pour les vendeurs</span>
          <span>✓ Paiement sous 24h</span>
        </div>
      </div>

      {/* SEO Text */}
      <div className="mt-12 prose prose-gray max-w-none">
        <h2>Vendre son or à {cityName} — Guide complet</h2>
        <p>
          Vous souhaitez vendre vos bijoux en or à {cityName} ? OrFlow vous propose la solution la plus avantageuse.
          Contrairement aux bijouteries et comptoirs d&apos;achat traditionnels qui rachètent l&apos;or entre 60% et 70%
          de sa valeur marchande, OrFlow vous connecte directement avec des acheteurs professionnels et particuliers
          prêts à payer jusqu&apos;à 85% du prix spot.
        </p>
        <h3>Comment fonctionne le prix de l&apos;or à {cityName} ?</h3>
        <p>
          Le prix de l&apos;or est identique partout en France — il suit le cours mondial du London Bullion Market (LBMA).
          Aujourd&apos;hui, l&apos;or 24 carats vaut <strong>{pricePerGram.toFixed(2)} €/gramme</strong>.
          Pour de l&apos;or 18 carats (le plus courant pour les bijoux), la valeur est de{' '}
          <strong>{(pricePerGram * 0.75).toFixed(2)} €/gramme</strong>.
        </p>
        <h3>Estimation gratuite à {cityName}</h3>
        <p>
          Notre outil d&apos;estimation gratuit vous permet de calculer instantanément la valeur de vos bijoux en or.
          Il vous suffit d&apos;entrer le poids et le titre (9k, 14k, 18k, 24k) pour obtenir une estimation précise
          basée sur le cours du jour.
        </p>
      </div>
    </div>
  );
}
