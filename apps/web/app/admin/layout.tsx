'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ADMIN_NAV as NAV } from '@/lib/nav';

// Client-side guard for a nicer experience only. The API enforces ADMIN on every
// admin route, so hiding pages here is not what keeps data safe.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { state, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === 'anonymous') router.replace('/login');
  }, [state.status, router]);

  if (state.status !== 'authenticated') {
    return (
      <div className="mx-auto max-w-5xl px-4">
        <Spinner />
      </div>
    );
  }

  if (state.user.role !== 'ADMIN') {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">Admins only</h1>
        <p className="mt-2 text-sm text-slate-600">Your account does not have access to the admin console.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">
          Go to home
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-bold text-brand-900">
            Capacity Connect <span className="font-normal text-slate-500">Admin</span>
          </Link>
          <div className="flex items-center gap-3 text-sm sm:order-last">
            <span className="hidden text-slate-600 sm:inline">{state.user.fullName}</span>
            <Button
              variant="secondary"
              className="min-h-8 px-3"
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
            >
              Sign out
            </Button>
          </div>
          {/* Phones: its own scrollable row under the logo. Desktop: between logo and Sign out. */}
          <nav className="order-last -mx-4 flex w-full gap-1 overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:px-0" aria-label="Admin">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                    active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
