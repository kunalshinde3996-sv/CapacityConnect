'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { Subject } from '@/lib/matching';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ subjects: Subject[] }>('/api/subjects')
      .then((data) => setSubjects(data.subjects))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load subjects'));
  }, []);

  return (
    <>
      <PageHeader
        title="Trainer matching"
        description="Pick a subject to rank trainers by how well their verified competencies cover its requirements."
      />

      {error && <Alert>{error}</Alert>}
      {!subjects && !error && <Spinner />}

      <ul className="grid gap-4 md:grid-cols-2">
        {subjects?.map((subject) => (
          <li key={subject.id} className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-slate-900">{subject.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{subject.description}</p>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Requires</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {subject.requirements.map((r) => (
                <li key={r.competency.id}>
                  <Badge tone="brand">
                    {r.competency.name} · L{r.minLevel}+ · {Math.round(r.weight * 100)}%
                  </Badge>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-1 items-end">
              <Link
                href={`/admin/subjects/${subject.id}/trainers`}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 sm:w-auto"
              >
                Find trainers
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
