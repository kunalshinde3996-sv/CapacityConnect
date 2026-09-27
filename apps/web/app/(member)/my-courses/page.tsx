'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DueAssessments } from '@/components/assessments/DueAssessments';
import { Alert, Badge, EmptyState, formatDate, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { courseDates } from '@/lib/courses';

interface MyEnrollment {
  id: string;
  status: 'ENROLLED' | 'COMPLETED' | 'DROPPED';
  enrolledAt: string;
  course: {
    id: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    subject: { name: string } | null;
    trainer: { fullName: string } | null;
    competencies: { targetLevel: number; competency: { id: string; name: string } }[];
    _count: { modules: number };
  };
}

export default function MyCoursesPage() {
  const [items, setItems] = useState<MyEnrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ enrollments: MyEnrollment[] }>('/api/me/courses')
      .then((d) => setItems(d.enrollments))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your courses'));
  }, []);

  return (
    <>
      <PageHeader title="My courses" description="Courses you are enrolled in." />
      <DueAssessments />
      {error && <Alert>{error}</Alert>}
      {!items && !error && <Spinner />}
      {items?.length === 0 && (
        <EmptyState>
          You are not enrolled in any course yet.{' '}
          <Link href="/courses" className="font-semibold text-brand-700 underline hover:no-underline">
            Browse courses
          </Link>
        </EmptyState>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {items?.map((e) => (
          <li key={e.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-semibold text-slate-900">
                <Link href={`/courses/${e.course.id}`} className="hover:text-brand-700 hover:underline">
                  {e.course.title}
                </Link>
              </h2>
              <Badge tone={e.status === 'COMPLETED' ? 'green' : 'brand'}>{e.status === 'COMPLETED' ? 'Completed' : 'In progress'}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {[e.course.trainer?.fullName, e.course.subject?.name].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {courseDates(e.course)} · enrolled {formatDate(e.enrolledAt)} · {e.course._count.modules} modules
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {e.course.competencies.map((c) => (
                <li key={c.competency.id}>
                  <Badge tone="brand">{c.competency.name} · L{c.targetLevel}</Badge>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}
