'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card, EmptyState, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { type AssessmentListItem, formatDateTime, timeLeft } from '@/lib/assessments';

// The trainer's list of a course's assessments (Assessments tab of the manage page).
export function TrainerAssessmentList({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<AssessmentListItem[] | null>(null);
  useEffect(() => {
    api<{ assessments: AssessmentListItem[] }>(`/api/courses/${courseId}/assessments`).then((d) => setItems(d.assessments)).catch(() => setItems([]));
  }, [courseId]);

  return (
    <Card
      title="Assessments"
      description="MCQ questionnaires. Each question tests one competency, so results are reported per competency."
      action={
        <Link href={`/trainer/courses/${courseId}/assessments/new`} className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          New assessment
        </Link>
      }
    >
      {!items && <Spinner />}
      {items?.length === 0 && <EmptyState>No assessments yet.</EmptyState>}
      <ul className="divide-y divide-slate-100">
        {items?.map((a) => (
          <li key={a.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href={`/trainer/assessments/${a.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                {a.title}
              </Link>
              <p className="text-sm text-slate-600">
                Deadline {formatDateTime(a.deadline)} ({timeLeft(a.deadline)}) · {a._count.questions} questions
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={a.published ? 'green' : 'amber'}>{a.published ? 'published' : 'draft'}</Badge>
              <Badge>{a._count.attempts ?? 0} submitted</Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
