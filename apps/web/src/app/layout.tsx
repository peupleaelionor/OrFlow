import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: {
    default: 'OrFlow - La marketplace de l\'or recyclé',
    template: '%s | OrFlow',
  },
  description: 'Achetez et vendez de l\'or recyclé en toute confiance. Estimation IA gratuite, enchères en temps réel, paiement sécurisé.',
  keywords: ['or recyclé', 'bijoux or', 'vendre or', 'acheter or', 'enchères or', 'marketplace or'],
  openGraph: {
    title: 'OrFlow - La marketplace de l\'or recyclé',
    description: 'La plateforme de référence pour le trading d\'or recyclé en France',
    type: 'website',
    locale: 'fr_FR',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
