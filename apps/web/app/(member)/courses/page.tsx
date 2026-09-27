'use client';

import { useEffect, useState } from 'react';
import { CourseCard } from '@/components/courses/CourseCard';
import { Alert, Button, EmptyState, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { CourseSummary } from '@/lib/courses';
import type { Competency } from '@/lib/profile';

// Course catalogue: published courses, searchable and filterable by competency.
export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ q: '', competencyId: '', subjectId: '' });

  useEffect(() => {
    api<{ competencies: Competency[] }>('/api/competencies').then((d) => setCompetencies(d.competencies)).catch(() => {});
  }, []);

  // Subject filter options come from the first, unfiltered load (all published courses).
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    // If the filters change again before this request returns, its (now outdated)
    // response must not overwrite the newer one.
    let stale = false;
    const active = Object.entries(filters).filter(([, v]) => v);
    api<{ courses: CourseSummary[] }>(`/api/courses?${new URLSearchParams(active)}`)
      .then((d) => {
        if (stale) return;
        setCourses(d.courses);
        if (active.length === 0) setSubjects(uniqueSubjects(d.courses));
      })
      .catch((err) => !stale && setError(err instanceof ApiError ? err.message : 'Could not load courses'));
    return () => {
      stale = true;
    };
  }, [filters]);

  return (
    <>
      <PageHeader title="Browse courses" description="Every course is tagged with the competencies it builds." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...filters, q });
        }}
        className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <Input aria-label="Search courses" placeholder="Search by title or description" value={q} onChange={(e) => setQ(e.target.value)} className="mt-0" />
        <Select aria-label="Filter by competency" value={filters.competencyId} onChange={(e) => setFilters({ ...filters, competencyId: e.target.value })} className="mt-0">
          <option value="">All competencies</option>
          {competencies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select aria-label="Filter by subject" value={filters.subjectId} onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })} className="mt-0">
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Button type="submit">Search</Button>
      </form>

      {error && <Alert>{error}</Alert>}
      {!courses && !error && <Spinner />}
      {courses?.length === 0 && <EmptyState>No courses match these filters.</EmptyState>}
      <ul className="grid gap-4 md:grid-cols-2">
        {courses?.map((c) => <CourseCard key={c.id} course={c} href={`/courses/${c.id}`} />)}
      </ul>
    </>
  );
}

function uniqueSubjects(courses: CourseSummary[]) {
  const map = new Map(courses.flatMap((c) => (c.subject ? [[c.subject.id, c.subject] as const] : [])));
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
