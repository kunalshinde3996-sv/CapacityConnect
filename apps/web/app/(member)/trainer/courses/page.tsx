'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CourseCard } from '@/components/courses/CourseCard';
import { Alert, EmptyState, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { CourseSummary } from '@/lib/courses';

export default function TeachingPage() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ courses: CourseSummary[] }>('/api/courses?mine=true')
      .then((d) => setCourses(d.courses))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your courses'));
  }, []);

  return (
    <>
      <PageHeader title="My teaching" description="Courses you teach or created, including drafts.">
        <Link href="/trainer/courses/new" className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          New course
        </Link>
      </PageHeader>
      {error && <Alert>{error}</Alert>}
      {!courses && !error && <Spinner />}
      {courses?.length === 0 && <EmptyState>You have no courses yet. Create your first one.</EmptyState>}
      <ul className="grid gap-4 md:grid-cols-2">
        {courses?.map((c) => <CourseCard key={c.id} course={c} href={`/trainer/courses/${c.id}`} showStatus />)}
      </ul>
    </>
  );
}
