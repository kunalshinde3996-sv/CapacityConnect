'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HorizontalBars, WeeklyLine } from '@/components/dashboard/Charts';
import { Alert, Card, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

interface Dashboard {
  users: { byRole: { role: string; count: number }[]; pending: number; disabled: number };
  courses: { published: number; draft: number; archived: number };
  enrolments: { total: number; completed: number };
  certifications: { verified: number; fromCourses: number; pendingVerification: number };
  attempts: { submitted: number; inProgress: number };
  participation: {
    participants: number;
    eligible: number;
    rate: number | null;
    byInstitute: { institute: string; name: string; participants: number; eligible: number; rate: number | null }[];
  };
  charts: { enrolmentsByCourse: { course: string; enrolments: number }[]; submissionsPerWeek: { weekStarting: string; submissions: number }[] };
}

const ROLE_LABELS: Record<string, string> = { TRAINEE: 'Trainees', TRAINER: 'Trainers', ADMIN: 'Admins' };

function Stat({ label, value, note, href }: { label: string; value: string | number; note?: string; href?: string }) {
  const body = (
    <>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-slate-600">{note}</dd>}
    </>
  );
  const cls = 'block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200';
  return href ? (
    <Link href={href} className={`${cls} hover:ring-brand-600`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function DashboardPage() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Dashboard>('/api/dashboard')
      .then(setD)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the dashboard'));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!d) return <Spinner />;

  const role = (r: string) => d.users.byRole.find((x) => x.role === r)?.count ?? 0;

  return (
    <>
      <PageHeader title="Dashboard" description="Training across MoES institutes at a glance." />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Trainees" value={role('TRAINEE')} note={`${d.users.pending} waiting for approval`} href="/admin/approvals" />
        <Stat label="Trainers" value={role('TRAINER')} />
        <Stat label="Published courses" value={d.courses.published} note={`${d.courses.draft} draft`} />
        <Stat label="Enrolments" value={d.enrolments.total} note={`${d.enrolments.completed} completed`} />
        <Stat label="Certifications" value={d.certifications.verified} note={`${d.certifications.fromCourses} from courses · ${d.certifications.pendingVerification} to verify`} href="/admin/verifications" />
        <Stat label="Assessments submitted" value={d.attempts.submitted} note={`${d.attempts.inProgress} in progress`} />
        <Stat
          label="Participation"
          value={d.participation.rate === null ? '–' : `${d.participation.rate}%`}
          note={`${d.participation.participants} of ${d.participation.eligible} trainees with an assessment took one`}
        />
        <Stat label="Skill gaps" value="View" note="Supply vs demand per competency" href="/admin/skill-gaps" />
      </dl>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Users by role" description="Approved accounts">
          <HorizontalBars
            data={d.users.byRole.map((r) => ({ Role: ROLE_LABELS[r.role] ?? r.role, Users: r.count }))}
            label="Role"
            value="Users"
            caption="Approved users by role"
          />
        </Card>
        <Card title="Assessment submissions" description="Per week, last 8 weeks">
          <WeeklyLine data={d.charts.submissionsPerWeek} caption="Assessment submissions per week over the last 8 weeks" />
        </Card>
        <Card title="Enrolments by course" description="Published courses">
          <HorizontalBars
            data={d.charts.enrolmentsByCourse.map((c) => ({ Course: c.course, Enrolments: c.enrolments }))}
            label="Course"
            value="Enrolments"
            caption="Enrolments per published course"
          />
        </Card>
        <Card title="Participation by institute" description="Share of trainees with an assessment who submitted at least one">
          <ul className="space-y-3">
            {d.participation.byInstitute.map((i) => (
              <li key={i.institute}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-900">{i.name}</span>
                  <span className="tabular-nums text-slate-700">
                    {i.rate === null ? 'no assessments yet' : `${i.rate}% · ${i.participants} of ${i.eligible}`}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${i.rate ?? 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
