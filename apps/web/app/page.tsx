'use client';

import Link from 'next/link';
import { Button, Spinner } from '@/components/ui';
import { homeFor, useAuth } from '@/lib/auth';

export default function HomePage() {
  const { state, logout } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Ministry of Earth Sciences</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Capacity Connect</h1>
      <p className="mt-4 text-slate-600">
        Competency-mapped training and learning management for MoES institutes. Every course, trainer and
        assessment is linked to one shared competency framework.
      </p>

      <div className="mt-8">
        {state.status === 'loading' && <Spinner />}
        {state.status === 'anonymous' && (
          <Link href="/login" className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            Sign in
          </Link>
        )}
        {state.status === 'authenticated' && (
          <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">
              Signed in as <span className="font-semibold text-slate-900">{state.user.fullName}</span> ({state.user.role.toLowerCase()})
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={homeFor(state.user)} className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                {state.user.role === 'ADMIN' ? 'Open admin console' : 'Continue'}
              </Link>
              <Button variant="secondary" onClick={logout}>
                Sign out
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
