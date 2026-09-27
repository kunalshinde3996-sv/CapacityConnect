'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AssessmentBuilder } from '@/components/assessments/AssessmentBuilder';
import { Alert, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { CourseDetail } from '@/lib/courses';

export default function NewAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ course: CourseDetail }>(`/api/courses/${id}`)
      .then((d) => setCourse(d.course))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the course'));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!course) return <Spinner />;

  return (
    <>
      <Link href={`/trainer/courses/${id}`} className="text-sm font-medium text-brand-600 hover:underline">
        ← {course.title}
      </Link>
      <div className="mt-3">
        <PageHeader title="New assessment" description="Saved as a draft. Publish it from the course's Assessments tab when it is ready." />
      </div>
      {course.competencies.length === 0 ? (
        <Alert tone="amber">Tag the course with competencies first: every question must test one of them.</Alert>
      ) : (
        <AssessmentBuilder
          competencies={course.competencies.map((c) => c.competency)}
          submitLabel="Save draft"
          onSubmit={async (body) => {
            const { assessment } = await api<{ assessment: { id: string } }>(`/api/courses/${id}/assessments`, { method: 'POST', body });
            router.push(`/trainer/assessments/${assessment.id}`);
          }}
        />
      )}
    </>
  );
}
