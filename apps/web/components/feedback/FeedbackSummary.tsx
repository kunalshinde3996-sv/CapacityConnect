'use client';

import { useEffect, useState } from 'react';
import { Alert, Badge, Card, EmptyState, formatDate, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

interface Summary {
  count: number;
  average: number | null;
  distribution: { stars: number; count: number }[];
  comments: { id: string; rating: number; comment: string; createdAt: string }[];
  teachingEvidence: { counts: boolean; minRatings: number; minAverage: number };
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

// The trainer's Feedback tab: average, distribution, anonymous comments, and whether
// this course currently counts as TEACHING evidence in trainer matching.
export function FeedbackSummary({ courseId }: { courseId: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>(`/api/courses/${courseId}/feedback`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load feedback'));
  }, [courseId]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const te = data.teachingEvidence;
  const needed = Math.max(0, te.minRatings - data.count);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Average rating">
          {data.average === null ? (
            <EmptyState>No ratings yet.</EmptyState>
          ) : (
            <>
              <p className="text-4xl font-bold tabular-nums text-slate-900">
                {data.average}
                <span className="text-lg font-normal text-slate-500"> / 5</span>
              </p>
              <p className="mt-1 text-amber-500" aria-hidden>{stars(Math.round(data.average))}</p>
              <p className="text-sm text-slate-600">from {data.count} trainee{data.count === 1 ? '' : 's'}</p>
              <ul className="mt-4 space-y-1.5">
                {data.distribution.map((d) => (
                  <li key={d.stars} className="flex items-center gap-2 text-sm">
                    <span className="w-10 shrink-0 tabular-nums text-slate-600">{d.stars} ★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${data.count ? (d.count / data.count) * 100 : 0}%` }} />
                    </span>
                    <span className="w-6 shrink-0 text-right tabular-nums text-slate-600">{d.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Teaching evidence" description={`Courses with at least ${te.minRatings} ratings averaging ${te.minAverage} or more count as a teaching record in trainer matching.`}>
          {te.counts ? (
            <div className="space-y-2 text-sm text-slate-700">
              <Badge tone="green">Counts as teaching evidence</Badge>
              <p>For every competency this course builds, you get a Teaching record at the course&apos;s target level (trust 0.8). It is used wherever it beats your own claim.</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-slate-700">
              <Badge tone="neutral">Not yet</Badge>
              <p>
                {needed > 0
                  ? `${needed} more rating${needed === 1 ? '' : 's'} needed.`
                  : `The average is below ${te.minAverage}. Low ratings never reduce your score; they just don't add evidence.`}
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card title="Comments" description="Shown without names so trainees can be honest.">
        {data.comments.length === 0 ? (
          <EmptyState>No written comments yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.comments.map((c) => (
              <li key={c.id} className="py-3 text-sm">
                <p className="text-amber-500" aria-label={`${c.rating} stars`}>{stars(c.rating)}</p>
                <p className="mt-1 text-slate-800">{c.comment}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(c.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
