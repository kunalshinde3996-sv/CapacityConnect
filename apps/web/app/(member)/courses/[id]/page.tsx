'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CourseMaterials } from '@/components/library/CourseMaterials';
import { Alert, Badge, Button, Card, levelLabel, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { courseDates, type CourseDetail, seatsLeft } from '@/lib/courses';

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useAuth();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolError, setEnrolError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const show = useCallback((d: { course: CourseDetail }) => setCourse(d.course), []);
  const fail = useCallback((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the course'), []);
  const load = useCallback(() => api<{ course: CourseDetail }>(`/api/courses/${id}`).then(show).catch(fail), [id, show, fail]);
  useEffect(() => {
    api<{ course: CourseDetail }>(`/api/courses/${id}`).then(show).catch(fail);
  }, [id, show, fail]);

  async function enrol() {
    setBusy(true);
    setEnrolError(null);
    try {
      await api(`/api/courses/${id}/enroll`, { method: 'POST' });
      await load();
    } catch (err) {
      setEnrolError(err instanceof ApiError ? err.message : 'Could not enrol');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!course) return <Spinner />;

  const isTrainee = state.status === 'authenticated' && state.user.role === 'TRAINEE';
  const enrolled = course.myEnrollment && course.myEnrollment.status !== 'DROPPED';
  const seats = seatsLeft(course);

  return (
    <>
      <Link href={isTrainee ? '/courses' : '/trainer/courses'} className="text-sm font-medium text-brand-600 hover:underline">
        ← {isTrainee ? 'All courses' : 'My teaching'}
      </Link>

      <div className="mt-3 mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {[course.trainer ? `${course.trainer.fullName}${course.trainer.designation ? `, ${course.trainer.designation}` : ''}` : 'Trainer to be assigned', course.subject?.name !== course.title && course.subject?.name]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {courseDates(course)} · {course._count.enrollments} enrolled
            {seats !== null && ` · ${seats === 0 ? 'full' : `${seats} seats left`}`}
          </p>
        </div>
        <div className="sm:shrink-0">
          {course.canManage && (
            <Link href={`/trainer/courses/${course.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              Manage course
            </Link>
          )}
          {isTrainee && enrolled && <Badge tone="green">You are enrolled</Badge>}
          {isTrainee && !enrolled && course.status === 'PUBLISHED' && (
            <Button onClick={enrol} disabled={busy || seats === 0} className="w-full sm:w-auto">
              {seats === 0 ? 'Course full' : busy ? 'Enrolling…' : 'Enrol in this course'}
            </Button>
          )}
        </div>
      </div>
      {enrolError && <div className="mb-4"><Alert>{enrolError}</Alert></div>}

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <Card title="About this course">
            <p className="whitespace-pre-line text-sm text-slate-700">{course.description}</p>
          </Card>
          <Card title="Modules" description={`${course.modules.length} module${course.modules.length === 1 ? '' : 's'}`}>
            <ol className="space-y-3">
              {course.modules.map((m, i) => (
                <li key={m.id} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                  <div>
                    <p className="font-medium text-slate-900">{m.title}</p>
                    {m.description && <p className="text-sm text-slate-600">{m.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <CourseMaterials courseId={course.id} />
        </div>
        <Card title="Competencies you will build">
          <ul className="space-y-2">
            {course.competencies.map((c) => (
              <li key={c.competency.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-slate-800">{c.competency.name}</span>
                <Badge tone="brand">target {levelLabel(c.targetLevel)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
