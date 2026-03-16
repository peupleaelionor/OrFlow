'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard/buyer';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [magicLink, setMagicLink] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();

    if (magicLink) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${redirect}` },
      });
      if (error) setError(error.message);
      else setError('Email envoyé ! Vérifiez votre boîte mail.');
    } else if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push(redirect);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirect}`,
          data: { role: 'buyer' },
        },
      });
      if (error) setError(error.message);
      else setError('Compte créé ! Vérifiez votre email pour confirmer.');
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orflow-dark to-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-3xl font-bold text-gold-400">OrFlow</Link>
          <p className="text-gray-400 mt-2">La marketplace de l&apos;or recyclé</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </h1>

          {error && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${error.includes('envoyé') || error.includes('Compte') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-400"
                placeholder="votre@email.com"
              />
            </div>

            {!magicLink && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gold-400"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold flex items-center justify-center"
            >
              {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : magicLink ? 'Envoyer le lien magique'
                : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          <div className="mt-4 space-y-2 text-center">
            <button
              onClick={() => setMagicLink(!magicLink)}
              className="text-sm text-gray-500 hover:text-gold-600"
            >
              {magicLink ? 'Connexion avec mot de passe' : '✨ Connexion sans mot de passe (lien magique)'}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-gray-600">
                Pas encore de compte ?{' '}
                <button onClick={() => setMode('signup')} className="text-gold-600 font-medium hover:text-gold-700">
                  S&apos;inscrire gratuitement
                </button>
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Déjà un compte ?{' '}
                <button onClick={() => setMode('login')} className="text-gold-600 font-medium hover:text-gold-700">
                  Se connecter
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
