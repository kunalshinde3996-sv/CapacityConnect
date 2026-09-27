'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Select, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/assessments';

type Status = 'SUBMITTED' | 'IN_PROGRESS' | 'PENDING' | 'MISSED';

interface Progress {
  summary: { enrolled: number; assessments: number; submissions: number; averagePercent: number | null; outstanding: number };
  assessments: {
    id: string;
    title: string;
    deadline: string;
    passPercent: number;
    closed: boolean;
    submitted: number;
    inProgress: number;
    pending: number;
    missed: number;
    averagePercent: number | null;
    passRate: number | null;
  }[];
  trainees: {
    user: { id: string; fullName: string; email: string; designation: string | null; institute: { code: string } | null };
    enrollmentStatus: 'ENROLLED' | 'COMPLETED';
    results: { assessmentId: string; status: Status; percent: number | null }[];
    averagePercent: number | null;
    outstanding: number;
  }[];
  competencies: { competencyId: string; name: string; percent: number; traineesAssessed: number }[];
}

const STATUS: Record<Status, { label: string; tone: 'green' | 'amber' | 'red' | 'neutral' }> = {
  SUBMITTED: { label: 'Submitted', tone: 'green' },
  IN_PROGRESS: { label: 'In progress', tone: 'amber' },
  PENDING: { label: 'Not started', tone: 'neutral' },
  MISSED: { label: 'Missed', tone: 'red' },
};

const barTone = (p: number) => (p >= 80 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-500');

// Trainer monitoring for one course: participation, scores and the class's weakest competencies.
export function ClassProgress({ courseId }: { courseId: string }) {
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'outstanding' | 'missed'>('all');

  const fail = useCallback((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load class progress'), []);
  const reload = useCallback(() => api<Progress>(`/api/courses/${courseId}/progress`).then(setData).catch(fail), [courseId, fail]);
  useEffect(() => {
    api<Progress>(`/api/courses/${courseId}/progress`).then(setData).catch(fail);
  }, [courseId, fail]);

  const trainees = useMemo(() => {
    if (!data) return [];
    if (filter === 'outstanding') return data.trainees.filter((t) => t.outstanding > 0);
    if (filter === 'missed') return data.trainees.filter((t) => t.results.some((r) => r.status === 'MISSED'));
    return data.trainees;
  }, [data, filter]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;
  if (data.summary.enrolled === 0) return <EmptyState>No trainees are enrolled yet.</EmptyState>;

  const titles = new Map(data.assessments.map((a) => [a.id, a.title]));

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Enrolled', data.summary.enrolled],
          ['Submissions', data.summary.submissions],
          ['Average score', data.summary.averagePercent === null ? '–' : `${data.summary.averagePercent}%`],
          ['Still to attempt', data.summary.outstanding],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Weakest competencies" description="Share of marks obtained across all submitted attempts, weakest first.">
          {data.competencies.length === 0 ? (
            <EmptyState>No submissions yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {data.competencies.map((c, i) => (
                <li key={c.competencyId}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-900">
                      {c.name}
                      {i === 0 && c.percent < 60 && <span className="ml-2"><Badge tone="red">Focus here</Badge></span>}
                    </span>
                    <span className="tabular-nums text-slate-600">{c.percent}% · {c.traineesAssessed} trainees</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div className={`h-full rounded-full ${barTone(c.percent)}`} style={{ width: `${c.percent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Assessments">
          {data.assessments.length === 0 ? (
            <EmptyState>No published assessments yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.assessments.map((a) => (
                <li key={a.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{a.title}</span>
                    <Badge tone={a.closed ? 'neutral' : 'brand'}>{a.closed ? 'closed' : 'open'}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">Deadline {formatDateTime(a.deadline)}</p>
                  <p className="mt-1 text-slate-700">
                    {a.submitted} submitted · {a.inProgress} in progress · {a.pending} not started · {a.missed} missed
                  </p>
                  {a.averagePercent !== null && (
                    <p className="text-slate-700">
                      Average {a.averagePercent}% · {a.passRate}% passed (pass mark {a.passPercent}%)
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Trainees"
        action={
          <Select aria-label="Show trainees" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="mt-0 w-auto">
            <option value="all">All trainees</option>
            <option value="outstanding">Still to attempt</option>
            <option value="missed">Missed a deadline</option>
          </Select>
        }
      >
        {trainees.length === 0 && <EmptyState>Nobody matches this filter.</EmptyState>}

        {/* Desktop: a table, one column per assessment */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Trainee</th>
                {data.assessments.map((a) => (
                  <th key={a.id} className="px-3 py-2 font-medium">{a.title}</th>
                ))}
                <th className="py-2 pl-3 text-right font-medium">Average</th>
                <th className="py-2 pl-3 font-medium">Course</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trainees.map((t) => (
                <tr key={t.user.id}>
                  <td className="py-2 pr-3">
                    <p className="font-medium text-slate-900">{t.user.fullName}</p>
                    <p className="text-xs text-slate-500">{[t.user.designation, t.user.institute?.code].filter(Boolean).join(' · ')}</p>
                  </td>
                  {t.results.map((r) => (
                    <td key={r.assessmentId} className="px-3 py-2">
                      {r.percent !== null ? <span className="font-semibold tabular-nums">{r.percent}%</span> : <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>}
                    </td>
                  ))}
                  <td className="py-2 pl-3 text-right font-semibold tabular-nums">{t.averagePercent === null ? '–' : `${t.averagePercent}%`}</td>
                  <td className="py-2 pl-3"><Completion courseId={courseId} trainee={t} onDone={reload} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phone: one card per trainee */}
        <ul className="space-y-3 md:hidden">
          {trainees.map((t) => (
            <li key={t.user.id} className="rounded-lg p-3 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{t.user.fullName}</p>
                  <p className="text-xs text-slate-500">{[t.user.designation, t.user.institute?.code].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{t.averagePercent === null ? '–' : `${t.averagePercent}%`}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {t.results.map((r) => (
                  <li key={r.assessmentId} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{titles.get(r.assessmentId)}</span>
                    {r.percent !== null ? <span className="font-semibold tabular-nums">{r.percent}%</span> : <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>}
                  </li>
                ))}
              </ul>
              <div className="mt-2 border-t border-slate-100 pt-2"><Completion courseId={courseId} trainee={t} onDone={reload} /></div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// "Mark completed" for one trainee: completes the enrolment and issues a course certificate.
function Completion({ courseId, trainee, onDone }: { courseId: string; trainee: Progress['trainees'][number]; onDone: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (trainee.enrollmentStatus === 'COMPLETED') return <Badge tone="green">Completed</Badge>;

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/courses/${courseId}/enrollments/${trainee.user.id}/complete`, { method: 'POST' });
      await onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark as completed');
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="secondary" className="min-h-8 whitespace-nowrap px-3" disabled={busy} onClick={complete} aria-label={`Mark course completed for ${trainee.user.fullName}`}>
        {busy ? 'Saving…' : 'Mark completed'}
      </Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
