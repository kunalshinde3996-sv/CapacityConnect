'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { type AssessmentListItem, formatDateTime, timeLeft, traineeStatus } from '@/lib/assessments';

type MyAssessment = AssessmentListItem & { course: { id: string; title: string } };

// "Due soon" strip on My courses: open assessments the trainee still has to take.
export function DueAssessments() {
  const [items, setItems] = useState<MyAssessment[]>([]);
  useEffect(() => {
    api<{ assessments: MyAssessment[] }>('/api/me/assessments').then((d) => setItems(d.assessments)).catch(() => {});
  }, []);

  const due = items.filter((a) => ['NOT_STARTED', 'IN_PROGRESS'].includes(traineeStatus(a).key));
  if (due.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 sm:p-5">
      <h2 className="font-semibold text-amber-900">
        {due.length} assessment{due.length === 1 ? '' : 's'} due
      </h2>
      <ul className="mt-3 space-y-2">
        {due.map((a) => {
          const status = traineeStatus(a);
          return (
            <li key={a.id} className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 ring-1 ring-amber-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/assessments/${a.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                  {a.title}
                </Link>
                <p className="text-xs text-slate-600">
                  {a.course.title} · due {formatDateTime(a.deadline)} ({timeLeft(a.deadline)})
                </p>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
