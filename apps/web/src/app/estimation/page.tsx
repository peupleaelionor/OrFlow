'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Zap, Upload, Calculator, TrendingUp, AlertCircle } from 'lucide-react';
import { formatEur, GOLD_PURITY_LABELS } from '@/lib/gold';
import type { GoldPurity } from '@orflow/types';

const schema = z.object({
  weight_grams: z.coerce.number().min(0.1, 'Poids minimum 0.1g').max(10000, 'Poids maximum 10kg'),
  purity: z.string() as z.ZodType<GoldPurity>,
  title: z.string().optional(),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ValuationResult {
  market_value_eur: number;
  recommended_price_eur: number;
  refinery_payout_eur: number;
  fine_gold_grams: number;
  price_per_gram_eur: number;
  reasoning?: string;
}

export default function EstimationPage() {
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { purity: '18k' },
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('weight_grams', data.weight_grams.toString());
      formData.append('purity', data.purity);
      if (data.description) formData.append('description', data.description);
      images.forEach(img => formData.append('images', img));

      const res = await fetch('/api/gold/estimate', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      setResult(json);
    } catch {
      alert('Erreur lors de l\'estimation. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gold-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 gold-badge mb-4">
            <Zap className="w-4 h-4" />
            <span>Estimation IA gratuite</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-gray-900 mb-3">
            Estimez la valeur de votre or
          </h1>
          <p className="text-gray-600 text-lg">
            Renseignez les caractéristiques de vos bijoux pour obtenir une estimation précise au prix du marché.
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poids total (grammes) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="ex: 15.5"
                {...register('weight_grams')}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-400"
              />
              {errors.weight_grams && (
                <p className="text-red-500 text-sm mt-1">{errors.weight_grams.message}</p>
              )}
            </div>

            {/* Purity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titre / Pureté de l&apos;or *
              </label>
              <select
                {...register('purity')}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-400"
              >
                {(Object.entries(GOLD_PURITY_LABELS) as [GoldPurity, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optionnel)
              </label>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Décrivez vos bijoux: bague, collier, bracelet, état, poinçons..."
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-400"
              />
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Photos (optionnel)
              </label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gold-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('image-upload')?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Cliquez pour ajouter des photos (améliore la précision de l&apos;estimation)
                </p>
                {images.length > 0 && (
                  <p className="text-gold-600 mt-2 font-medium">{images.length} photo(s) sélectionnée(s)</p>
                )}
              </div>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => setImages(Array.from(e.target.files || []))}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold flex items-center justify-center gap-2 text-lg"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Calcul en cours...
                </>
              ) : (
                <>
                  <Calculator className="w-5 h-5" />
                  Estimer maintenant
                </>
              )}
            </button>
          </form>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-8 card p-8 border-2 border-gold-200">
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-gold-500" />
              Résultat de l&apos;estimation
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gold-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gold-700 font-medium">Valeur marchande</p>
                <p className="text-2xl font-bold text-gold-800 mt-1">{formatEur(result.market_value_eur)}</p>
                <p className="text-xs text-gold-600 mt-1">Prix spot actuel</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-sm text-green-700 font-medium">Prix conseillé</p>
                <p className="text-2xl font-bold text-green-800 mt-1">{formatEur(result.recommended_price_eur)}</p>
                <p className="text-xs text-green-600 mt-1">Pour vente rapide</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
                <p className="text-sm text-blue-700 font-medium">Paiement raffinerie</p>
                <p className="text-2xl font-bold text-blue-800 mt-1">{formatEur(result.refinery_payout_eur)}</p>
                <p className="text-xs text-blue-600 mt-1">96% du spot</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 mb-4">
              <p><strong>Or fin:</strong> {result.fine_gold_grams.toFixed(3)}g à {formatEur(result.price_per_gram_eur)}/g</p>
            </div>

            {result.reasoning && (
              <div className="flex gap-2 text-sm text-gray-500 bg-blue-50 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p>{result.reasoning}</p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <a href="/sell" className="flex-1 btn-gold text-center">
                Mettre en vente
              </a>
              <a href="/auction/create" className="flex-1 btn-outline-gold text-center">
                Créer une enchère
              </a>
            </div>
          </div>
        )}

        {/* Info section */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-sm text-gray-500">
          <div className="card p-4">
            <p className="font-medium text-gray-700 mb-1">Comment ça marche ?</p>
            <p>Notre IA calcule la valeur de votre or basée sur le cours spot en temps réel et la pureté de votre métal.</p>
          </div>
          <div className="card p-4">
            <p className="font-medium text-gray-700 mb-1">Formule utilisée</p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-1">
              valeur = poids × (carats/24) × prix_spot
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
