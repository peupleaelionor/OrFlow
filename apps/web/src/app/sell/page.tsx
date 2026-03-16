'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Upload, Calculator, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GOLD_PURITY_LABELS } from '@/lib/gold';
import type { GoldPurity, ItemType } from '@orflow/types';

const schema = z.object({
  title: z.string().min(5, 'Titre trop court').max(100),
  description: z.string().optional(),
  item_type: z.string() as z.ZodType<ItemType>,
  gold_purity: z.string() as z.ZodType<GoldPurity>,
  weight_grams: z.coerce.number().min(0.1).max(10000),
  asking_price_eur: z.coerce.number().optional(),
  minimum_offer_eur: z.coerce.number().optional(),
  is_negotiable: z.boolean().default(true),
  allow_offers: z.boolean().default(true),
  location_city: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const ITEM_TYPES: [ItemType, string][] = [
  ['ring', 'Bague / Alliance'],
  ['necklace', 'Collier / Chaîne'],
  ['bracelet', 'Bracelet'],
  ['earrings', 'Boucles d\'oreilles'],
  ['coin', 'Pièce de monnaie'],
  ['bar', 'Lingot'],
  ['scrap', 'Or cassé / Lot'],
  ['watch', 'Montre'],
  ['pendant', 'Pendentif'],
  ['other', 'Autre'],
];

export default function SellPage() {
  const router = useRouter();
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [estimatedValue, setEstimatedValue] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      gold_purity: '18k',
      item_type: 'ring',
      is_negotiable: true,
      allow_offers: true,
    },
  });

  const watchWeight = watch('weight_grams');
  const watchPurity = watch('gold_purity');

  async function estimateValue() {
    if (!watchWeight || !watchPurity) return;
    const res = await fetch('/api/gold/estimate', {
      method: 'POST',
      body: (() => {
        const fd = new FormData();
        fd.append('weight_grams', watchWeight.toString());
        fd.append('purity', watchPurity);
        return fd;
      })(),
    });
    const data = await res.json();
    setEstimatedValue(data.recommended_price_eur);
  }

  async function onSubmit(data: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login?redirect=/sell'); return; }

    setUploading(true);
    let imageUrls: string[] = [];

    // Upload images
    if (images.length > 0) {
      for (const img of images.slice(0, 5)) {
        const ext = img.name.split('.').pop();
        const path = `listings/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData } = await supabase.storage
          .from('listings')
          .upload(path, img, { contentType: img.type });
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(path);
          imageUrls.push(publicUrl);
        }
      }
    }

    const { data: listing, error } = await supabase.from('listings').insert({
      seller_id: user.id,
      title: data.title,
      description: data.description,
      item_type: data.item_type,
      gold_purity: data.gold_purity,
      weight_grams: data.weight_grams,
      asking_price_eur: data.asking_price_eur || null,
      minimum_offer_eur: data.minimum_offer_eur || null,
      estimated_value_eur: estimatedValue,
      is_negotiable: data.is_negotiable,
      allow_offers: data.allow_offers,
      location_city: data.location_city,
      images: imageUrls,
      status: 'pending_review',
    }).select().single();

    setUploading(false);
    if (!error && listing) {
      setSuccess(true);
      setTimeout(() => router.push('/dashboard/seller'), 2000);
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Annonce créée !</h2>
        <p className="text-gray-600">Votre annonce est en cours de validation. Vous serez notifié dès qu'elle sera publiée.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl font-bold text-gray-900 mb-2">Vendre mon or</h1>
      <p className="text-gray-600 mb-8">Créez votre annonce en quelques minutes.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Title */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Description de l&apos;article</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Titre *</label>
            <input {...register('title')} placeholder="ex: Collier or 18k 15g - Ancien" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-400" />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Type d&apos;objet *</label>
              <select {...register('item_type')} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-400">
                {ITEM_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Pureté de l&apos;or *</label>
              <select {...register('gold_purity')} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-400">
                {(Object.entries(GOLD_PURITY_LABELS) as [GoldPurity, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Poids total (grammes) *</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                {...register('weight_grams')}
                placeholder="ex: 15.5"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-400"
              />
              <button type="button" onClick={estimateValue} className="btn-outline-gold text-sm flex items-center gap-1 px-3">
                <Calculator className="w-4 h-4" /> Estimer
              </button>
            </div>
            {estimatedValue && (
              <p className="text-green-700 text-sm mt-1">💡 Valeur estimée: <strong>{estimatedValue.toFixed(2)} €</strong></p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <textarea {...register('description')} rows={3} placeholder="État, historique, poinçons, certificats..." className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-400" />
          </div>
        </div>

        {/* Pricing */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Prix</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Prix demandé (€)</label>
              <input type="number" {...register('asking_price_eur')} placeholder="Laisser vide = offre libre" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Offre minimum (€)</label>
              <input type="number" {...register('minimum_offer_eur')} placeholder="Optionnel" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-400" />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_negotiable')} className="w-4 h-4 text-gold-500" />
              <span className="text-sm text-gray-700">Prix négociable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('allow_offers')} className="w-4 h-4 text-gold-500" />
              <span className="text-sm text-gray-700">Accepter les offres</span>
            </label>
          </div>
        </div>

        {/* Photos */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Photos</h2>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gold-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById('img-upload')?.click()}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Cliquez pour ajouter des photos (max 5)</p>
            <p className="text-gray-400 text-xs mt-1">Les annonces avec photos se vendent 3x plus vite</p>
            {images.length > 0 && (
              <p className="text-gold-600 font-medium mt-2">{images.length} photo(s) sélectionnée(s)</p>
            )}
          </div>
          <input id="img-upload" type="file" accept="image/*" multiple className="hidden" onChange={e => setImages(Array.from(e.target.files || []).slice(0, 5))} />
        </div>

        {/* Location */}
        <div className="card p-6">
          <label className="text-sm font-medium text-gray-700 block mb-1">Ville</label>
          <input {...register('location_city')} placeholder="ex: Paris" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold-400" />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || uploading}
          className="w-full btn-gold text-lg flex items-center justify-center gap-2"
        >
          {isSubmitting || uploading ? (
            <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Création en cours...</>
          ) : 'Publier mon annonce'}
        </button>
      </form>
    </div>
  );
}
