import Link from 'next/link';
import { ArrowRight, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orflow-dark via-gray-900 to-orflow-gray text-white">
      <div className="text-center px-4">
        <h1 className="font-display text-8xl font-bold text-gold-400 mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page introuvable</h2>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="btn-gold inline-flex items-center gap-2"
          >
            <Home className="w-5 h-5" />
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/marketplace"
            className="btn-outline-gold inline-flex items-center gap-2 border-white/40 text-white hover:bg-white/10"
          >
            Voir le marketplace
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
