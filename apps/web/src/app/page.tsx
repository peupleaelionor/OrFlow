import Link from 'next/link';
import { Zap, Shield, TrendingUp, Award, ArrowRight, Star } from 'lucide-react';
import GoldPriceTicker from '@/components/GoldPriceTicker';
import FeaturedListings from '@/components/FeaturedListings';
import AuctionCountdown from '@/components/AuctionCountdown';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-orflow-dark via-gray-900 to-orflow-gray text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-gold-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-gold-600 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32">
          <div className="text-center">
            {/* Live gold price */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-2 text-sm mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Or 24k en direct :</span>
              <GoldPriceTicker />
            </div>

            <h1 className="font-display text-5xl sm:text-7xl font-bold mb-6 leading-tight">
              La marketplace de<br />
              <span className="text-gold-400">l&apos;or recyclé</span>
            </h1>

            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
              Vendez vos bijoux en or au meilleur prix. Achetez en toute confiance.
              Estimation IA gratuite et instantanée.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/estimation" className="btn-gold inline-flex items-center gap-2 text-lg">
                Estimer mon or gratuitement
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/marketplace" className="btn-outline-gold inline-flex items-center gap-2 text-lg border-white/40 text-white hover:bg-white/10">
                Voir le marketplace
              </Link>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-gold-400 fill-gold-400" />
                <span>+2000 transactions</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Paiement sécurisé</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="w-4 h-4 text-blue-400" />
                <span>Vendeurs vérifiés</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Auctions */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-display font-bold text-gray-900">Enchères en cours</h2>
            <p className="text-gray-500 mt-1">Participez aux ventes aux enchères en temps réel</p>
          </div>
          <Link href="/auction" className="text-gold-600 font-semibold hover:text-gold-700 flex items-center gap-1">
            Voir toutes les enchères <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <AuctionCountdown />
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-display font-bold text-center text-gray-900 mb-12">
            Pourquoi choisir OrFlow ?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                color: 'text-yellow-500 bg-yellow-50',
                title: 'Estimation IA instantanée',
                desc: 'Notre IA analyse vos bijoux en quelques secondes et calcule la valeur exacte de votre or au cours du marché.',
              },
              {
                icon: TrendingUp,
                color: 'text-green-500 bg-green-50',
                title: 'Meilleur prix garanti',
                desc: 'Mettez en concurrence des acheteurs professionnels et particuliers. Vendez toujours au prix optimal.',
              },
              {
                icon: Shield,
                color: 'text-blue-500 bg-blue-50',
                title: 'Sécurité totale',
                desc: 'Paiement sécurisé par Stripe. Fonds garantis avant envoi. Vendeurs et acheteurs vérifiés.',
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="card p-6">
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marketplace Preview */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-display font-bold text-gray-900">Dernières annonces</h2>
            <p className="text-gray-500 mt-1">Trouvez votre prochain lot d&apos;or recyclé</p>
          </div>
          <Link href="/marketplace" className="text-gold-600 font-semibold hover:text-gold-700 flex items-center gap-1">
            Voir tout <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <FeaturedListings />
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-gold-600 to-gold-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-display text-4xl font-bold mb-4">
            Prêt à vendre votre or ?
          </h2>
          <p className="text-gold-100 text-xl mb-8">
            Obtenez une estimation gratuite en 30 secondes
          </p>
          <Link href="/sell" className="bg-white text-gold-800 font-bold px-8 py-4 rounded-xl hover:bg-gold-50 transition-colors inline-flex items-center gap-2">
            Commencer maintenant <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-display font-bold text-xl mb-4">OrFlow</h3>
              <p className="text-sm">La marketplace de référence pour l&apos;or recyclé en France et en Europe.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Vendeurs</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/sell" className="hover:text-white">Vendre mon or</Link></li>
                <li><Link href="/estimation" className="hover:text-white">Estimation gratuite</Link></li>
                <li><Link href="/dashboard/seller" className="hover:text-white">Mon espace vendeur</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Acheteurs</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/marketplace" className="hover:text-white">Marketplace</Link></li>
                <li><Link href="/auction" className="hover:text-white">Enchères</Link></li>
                <li><Link href="/dashboard/buyer" className="hover:text-white">Mon espace acheteur</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/legal/cgv" className="hover:text-white">CGV</Link></li>
                <li><Link href="/legal/privacy" className="hover:text-white">Confidentialité</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            © {new Date().getFullYear()} OrFlow. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
