'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CourseForm } from '@/components/courses/CourseForm';
import { ModulesEditor } from '@/components/courses/ModulesEditor';
import { CourseMaterials } from '@/components/library/CourseMaterials';
import { UploadForm } from '@/components/library/UploadForm';
import { useSubmit } from '@/lib/useSubmit';
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { type CourseDetail, STATUS_TONE } from '@/lib/courses';

const TABS = [
  { id: 'overview', label: 'Details' },
  { id: 'modules', label: 'Modules' },
  { id: 'library', label: 'Library' },
] as const;
type Tab = (typeof TABS)[number]['id'];

// Where a trainer manages one course. Later phases add Library, Assessments,
// Class progress and Feedback tabs.
export default function ManageCoursePage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [libraryVersion, setLibraryVersion] = useState(0); // bump to reload course materials
  const status = useSubmit();

  const show = useCallback((d: { course: CourseDetail }) => setCourse(d.course), []);
  const fail = useCallback((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the course'), []);
  const reload = useCallback(() => api<{ course: CourseDetail }>(`/api/courses/${id}`).then(show).catch(fail), [id, show, fail]);
  useEffect(() => {
    api<{ course: CourseDetail }>(`/api/courses/${id}`).then(show).catch(fail);
  }, [id, show, fail]);

  if (error) return <Alert>{error}</Alert>;
  if (!course) return <Spinner />;
  if (!course.canManage) return <Alert>You do not manage this course.</Alert>;

  const changeStatus = (action: 'publish' | 'unpublish' | 'archive') =>
    status.run(async () => {
      await api(`/api/courses/${id}/${action}`, { method: 'POST' });
      await reload();
    });

  return (
    <>
      <Link href="/trainer/courses" className="text-sm font-medium text-brand-600 hover:underline">
        ← My teaching
      </Link>
      <div className="mt-3 mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
            <Badge tone={STATUS_TONE[course.status]}>{course.status.toLowerCase()}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {course._count.enrollments} enrolled · {course.modules.length} modules ·{' '}
            <Link href={`/courses/${course.id}`} className="text-brand-600 hover:underline">view as trainee</Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status !== 'PUBLISHED' && (
            <Button onClick={() => changeStatus('publish')} disabled={status.busy}>Publish</Button>
          )}
          {course.status === 'PUBLISHED' && course._count.enrollments === 0 && (
            <Button variant="secondary" onClick={() => changeStatus('unpublish')} disabled={status.busy}>Back to draft</Button>
          )}
          {course.status === 'PUBLISHED' && (
            <Button variant="secondary" onClick={() => changeStatus('archive')} disabled={status.busy}>Archive</Button>
          )}
        </div>
      </div>
      {status.error && <div className="mb-4"><Alert>{status.error}</Alert></div>}

      <div className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Card title="Course details">
          <CourseForm
            initial={course}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              await api(`/api/courses/${id}`, { method: 'PATCH', body: values });
              await reload();
            }}
          />
        </Card>
      )}
      {tab === 'modules' && (
        <Card title="Modules" description="Trainees see modules in this order.">
          <ModulesEditor courseId={course.id} modules={course.modules} onChanged={reload} />
        </Card>
      )}
      {tab === 'library' && (
        <div className="space-y-5">
          <Card title="Upload to this course">
            <UploadForm course={course} onUploaded={() => setLibraryVersion((v) => v + 1)} />
          </Card>
          <CourseMaterials courseId={course.id} refreshKey={libraryVersion} />
        </div>
      )}
    </>
  );
}
