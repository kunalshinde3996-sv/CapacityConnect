'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DueAssessments } from '@/components/assessments/DueAssessments';
import { Badge, Button, formatDate, SkipLink } from '@/components/ui';
import { api } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { TYPE_LABELS, type LibraryType } from '@/lib/library';

interface Feed {
  announcements: { id: string; type: 'NOTICE' | 'ACHIEVEMENT' | 'NEW_CONTENT'; title: string; body: string; linkUrl: string | null; publishedAt: string }[];
  newContent: {
    courses: { id: string; title: string; createdAt: string; subject: { name: string } | null; trainer: { fullName: string } | null }[];
    library: { id: string; title: string; type: LibraryType; createdAt: string; uploadedBy: { fullName: string } }[];
  };
}

const linkClass = 'inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700';

function AnnouncementList({ items, empty }: { items: Feed['announcements']; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-600">{empty}</p>;
  return (
    <ul className="space-y-4">
      {items.map((a) => (
        <li key={a.id}>
          <p className="text-xs text-slate-600">{formatDate(a.publishedAt)}</p>
          <p className="font-semibold text-slate-900">{a.title}</p>
          <p className="mt-0.5 text-sm text-slate-700">{a.body}</p>
          {a.linkUrl && (
            <a href={a.linkUrl} className="mt-1 inline-block text-sm font-medium text-brand-700 hover:underline">
              Read more →
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

// Public homepage: notices, achievements and new learning content for everyone, plus a
// personal strip once signed in.
export default function HomePage() {
  const { state, logout } = useAuth();
  const [feed, setFeed] = useState<Feed | null>(null);

  useEffect(() => {
    api<Feed>('/api/announcements/public').then(setFeed).catch(() => setFeed({ announcements: [], newContent: { courses: [], library: [] } }));
  }, []);

  const notices = feed?.announcements.filter((a) => a.type === 'NOTICE') ?? [];
  const achievements = feed?.announcements.filter((a) => a.type === 'ACHIEVEMENT') ?? [];
  const contentNews = feed?.announcements.filter((a) => a.type === 'NEW_CONTENT') ?? [];
  const signedIn = state.status === 'authenticated';

  return (
    <div className="min-h-screen">
      <SkipLink />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-bold text-brand-900">Capacity Connect</span>
          {state.status === 'anonymous' && <Link href="/login" className={linkClass}>Sign in</Link>}
          {signedIn && (
            <div className="flex items-center gap-2">
              <Link href={homeFor(state.user)} className={linkClass}>{state.user.role === 'ADMIN' ? 'Admin console' : 'Continue'}</Link>
              <Button variant="secondary" onClick={logout}>Sign out</Button>
            </div>
          )}
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 focus:outline-none sm:py-12">
        <section aria-labelledby="hero">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Ministry of Earth Sciences</p>
          <h1 id="hero" className="mt-2 text-3xl font-bold sm:text-4xl">Capacity Connect</h1>
          <p className="mt-3 max-w-2xl text-slate-700">
            Competency-mapped training for IMD, INCOIS, NCPOR and other MoES institutes. Every course, trainer and assessment is
            linked to one shared competency framework, so training goes where the skill gaps are.
          </p>
        </section>

        {signedIn && (
          <section className="mt-8 rounded-xl bg-white p-5 ring-1 ring-slate-200" aria-label="Your summary">
            <p className="text-sm text-slate-700">
              Signed in as <span className="font-semibold text-slate-900">{state.user.fullName}</span> ({state.user.role.toLowerCase()})
            </p>
            {state.user.role === 'TRAINEE' && (
              <div className="mt-4">
                <DueAssessments />
              </div>
            )}
          </section>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <section aria-labelledby="notices" className="lg:col-span-2">
            <h2 id="notices" className="mb-4 text-lg font-bold text-slate-900">Announcements</h2>
            <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
              {feed ? <AnnouncementList items={notices} empty="No announcements right now." /> : <p className="text-sm text-slate-600">Loading…</p>}
            </div>
          </section>
          <section aria-labelledby="achievements">
            <h2 id="achievements" className="mb-4 text-lg font-bold text-slate-900">Achievements</h2>
            <div className="rounded-xl bg-amber-50 p-5 ring-1 ring-amber-200">
              {feed ? <AnnouncementList items={achievements} empty="Achievements will appear here." /> : <p className="text-sm text-slate-600">Loading…</p>}
            </div>
          </section>
        </div>

        <section aria-labelledby="new-content" className="mt-10">
          <h2 id="new-content" className="mb-4 text-lg font-bold text-slate-900">New learning content</h2>
          {contentNews.length > 0 && (
            <div className="mb-4 rounded-xl bg-white p-5 ring-1 ring-slate-200">
              <AnnouncementList items={contentNews} empty="" />
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
              <h3 className="font-semibold text-slate-900">Latest courses</h3>
              <ul className="mt-3 space-y-3">
                {feed?.newContent.courses.map((c) => (
                  <li key={c.id}>
                    <Link href={signedIn ? `/courses/${c.id}` : '/login'} className="font-medium text-brand-700 hover:underline">{c.title}</Link>
                    <p className="text-sm text-slate-600">{[c.trainer?.fullName, c.subject?.name].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
              <h3 className="font-semibold text-slate-900">New in the library</h3>
              <ul className="mt-3 space-y-3">
                {feed?.newContent.library.map((l) => (
                  <li key={l.id}>
                    <Link href={signedIn ? `/library/${l.id}` : '/login'} className="font-medium text-brand-700 hover:underline">{l.title}</Link>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <Badge>{TYPE_LABELS[l.type]}</Badge> {l.uploadedBy.fullName}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {!signedIn && <p className="mt-4 text-sm text-slate-600">Sign in with your MoES account to enrol and open the material.</p>}
        </section>
      </main>
    </div>
  );
}
