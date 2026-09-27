'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card, EmptyState, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { type AssessmentListItem, formatDateTime, timeLeft, traineeStatus } from '@/lib/assessments';

// Assessments of one course, as a trainee sees them (only when enrolled).
export function CourseAssessments({ courseId }: { courseId: string }) {
  const [items, setItems] = useState<AssessmentListItem[] | null>(null);
  const [notEnrolled, setNotEnrolled] = useState(false);

  useEffect(() => {
    api<{ assessments: AssessmentListItem[] }>(`/api/courses/${courseId}/assessments`)
      .then((d) => setItems(d.assessments))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) setNotEnrolled(true);
        setItems([]);
      });
  }, [courseId]);

  return (
    <Card title="Assessments">
      {!items && <Spinner />}
      {notEnrolled && <EmptyState>Enrol in the course to take its assessments.</EmptyState>}
      {items?.length === 0 && !notEnrolled && <EmptyState>No assessments published yet.</EmptyState>}
      <ul className="divide-y divide-slate-100">
        {items?.map((a) => {
          const status = traineeStatus(a);
          const href = status.key === 'SUBMITTED' ? `/assessments/${a.id}/result` : `/assessments/${a.id}`;
          return (
            <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={href} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                  {a.title}
                </Link>
                <p className="text-sm text-slate-600">
                  {a._count.questions} questions · due {formatDateTime(a.deadline)}
                  {status.key !== 'SUBMITTED' && status.key !== 'MISSED' && ` (${timeLeft(a.deadline)})`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {a.myAttempt?.submittedAt && a.myAttempt.maxScore ? (
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {Math.round(((a.myAttempt.score ?? 0) / a.myAttempt.maxScore) * 100)}%
                  </span>
                ) : null}
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
