'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { state, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; tone: 'red' | 'amber' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in (e.g. restored from the refresh cookie): skip the form.
  useEffect(() => {
    if (state.status === 'authenticated') router.replace(homeFor(state.user));
  }, [state, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      router.replace(homeFor(user));
    } catch (err) {
      if (err instanceof ApiError) {
        // Pending / rejected / disabled are not "wrong password": show them differently.
        const isStatus = err.code.startsWith('ACCOUNT_');
        setError({ message: err.message, tone: isStatus ? 'amber' : 'red' });
      } else {
        setError({ message: 'Cannot reach the server. Check your connection and try again.', tone: 'red' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Ministry of Earth Sciences</p>
        <h1 className="mt-1 text-2xl font-bold">Sign in to Capacity Connect</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {error && <Alert tone={error.tone}>{error.message}</Alert>}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border-0 px-3 py-2.5 text-base ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border-0 px-3 py-2.5 text-base ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600 sm:text-sm"
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  );
}
