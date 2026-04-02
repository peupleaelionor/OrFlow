import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Playfair+Display:wght@400..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
