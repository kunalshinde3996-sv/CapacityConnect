'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AssessmentBuilder, type BuilderValues, toLocalInput } from '@/components/assessments/AssessmentBuilder';
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, type Option } from '@/lib/assessments';
import type { CourseDetail } from '@/lib/courses';
import { useSubmit } from '@/lib/useSubmit';

interface TrainerAssessment {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  durationMinutes: number | null;
  passPercent: number;
  published: boolean;
  locked: boolean;
  course: { id: string; title: string };
  questions: { id: string; text: string; marks: number; competency: { id: string; name: string }; options: Option[]; correctIndex: number; explanation: string | null }[];
}

export default function EditAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const [assessment, setAssessment] = useState<TrainerAssessment | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const status = useSubmit();

  const show = useCallback(async (d: { assessment: TrainerAssessment }) => {
    setAssessment(d.assessment);
    setCourse((await api<{ course: CourseDetail }>(`/api/courses/${d.assessment.course.id}`)).course);
  }, []);
  const fail = useCallback((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the assessment'), []);
  const reload = useCallback(() => api<{ assessment: TrainerAssessment }>(`/api/assessments/${id}`).then(show).catch(fail), [id, show, fail]);
  useEffect(() => {
    api<{ assessment: TrainerAssessment }>(`/api/assessments/${id}`).then(show).catch(fail);
  }, [id, show, fail]);

  if (error) return <Alert>{error}</Alert>;
  if (!assessment || !course) return <Spinner />;

  const initial: BuilderValues = {
    title: assessment.title,
    description: assessment.description ?? '',
    deadline: toLocalInput(assessment.deadline),
    durationMinutes: assessment.durationMinutes?.toString() ?? '',
    passPercent: String(assessment.passPercent),
    questions: assessment.questions.map((q) => ({
      text: q.text,
      competencyId: q.competency.id,
      options: q.options.map((o) => o.text),
      correctIndex: q.correctIndex,
      marks: q.marks,
      explanation: q.explanation ?? '',
    })),
  };

  return (
    <>
      <Link href={`/trainer/courses/${assessment.course.id}`} className="text-sm font-medium text-brand-600 hover:underline">
        ← {assessment.course.title}
      </Link>
      <div className="mt-3 mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{assessment.title}</h1>
            <Badge tone={assessment.published ? 'green' : 'amber'}>{assessment.published ? 'published' : 'draft'}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Deadline {formatDateTime(assessment.deadline)} · {assessment.questions.length} questions
          </p>
        </div>
        <div className="flex gap-2">
          {!assessment.published && (
            <Button disabled={status.busy} onClick={() => status.run(async () => { await api(`/api/assessments/${id}/publish`, { method: 'POST' }); await reload(); })}>
              Publish
            </Button>
          )}
          {assessment.published && !assessment.locked && (
            <Button variant="secondary" disabled={status.busy} onClick={() => status.run(async () => { await api(`/api/assessments/${id}/unpublish`, { method: 'POST' }); await reload(); })}>
              Unpublish
            </Button>
          )}
        </div>
      </div>
      {status.error && <div className="mb-4"><Alert>{status.error}</Alert></div>}

      {assessment.locked ? (
        <>
          <div className="mb-4">
            <Alert tone="amber">Trainees have started this assessment, so its questions are locked. Everyone answers exactly the same questions.</Alert>
          </div>
          <div className="space-y-3">
            {assessment.questions.map((q, i) => (
              <Card key={q.id} title={`${i + 1}. ${q.text}`} description={`${q.competency.name} · ${q.marks} mark${q.marks === 1 ? '' : 's'}`}>
                <ul className="space-y-1 text-sm">
                  {q.options.map((o, j) => (
                    <li key={o.id} className={j === q.correctIndex ? 'font-semibold text-emerald-700' : 'text-slate-700'}>
                      {j === q.correctIndex ? '✓ ' : '• '}
                      {o.text}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          {saved && <div className="mb-4"><Alert tone="green">Saved.</Alert></div>}
          <AssessmentBuilder
            key={assessment.questions.map((q) => q.id).join()}
            competencies={course.competencies.map((c) => c.competency)}
            initial={initial}
            submitLabel="Save changes"
            onSubmit={async (body) => {
              await api(`/api/assessments/${id}`, { method: 'PUT', body });
              setSaved(true);
              await reload();
            }}
          />
        </>
      )}
    </>
  );
}
