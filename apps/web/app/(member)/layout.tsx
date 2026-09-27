'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { NotificationBell } from '@/components/NotificationBell';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { NAV } from '@/lib/nav';

// Shared layout for trainee and trainer pages (the "(member)" folder does not appear in URLs).
// Like the admin layout, this guard is for convenience; the API enforces every role check.
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const { state, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === 'anonymous') router.replace('/login');
    if (state.status === 'authenticated' && state.user.role === 'ADMIN') router.replace('/admin/approvals');
  }, [state, router]);

  if (state.status !== 'authenticated' || state.user.role === 'ADMIN') {
    return (
      <div className="mx-auto max-w-5xl px-4">
        <Spinner />
      </div>
    );
  }

  const nav = NAV[state.user.role];
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-bold text-brand-900">
            Capacity Connect{' '}
            <span className="font-normal text-slate-500">{state.user.role === 'TRAINER' ? 'Trainer' : 'Learner'}</span>
          </Link>
          <div className="flex items-center gap-3 text-sm sm:order-last">
            <NotificationBell />
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
          <nav className="order-last -mx-4 flex w-full gap-1 overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:px-0" aria-label="Main">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
