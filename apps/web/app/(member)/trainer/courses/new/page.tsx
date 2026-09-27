'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CourseForm } from '@/components/courses/CourseForm';
import { Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';

export default function NewCoursePage() {
  const router = useRouter();
  return (
    <>
      <Link href="/trainer/courses" className="text-sm font-medium text-brand-600 hover:underline">
        ← My teaching
      </Link>
      <div className="mt-3">
        <PageHeader title="New course" description="Saved as a draft. Add modules, then publish it when it is ready." />
      </div>
      <Card title="Course details">
        <CourseForm
          submitLabel="Create draft"
          onSubmit={async (values) => {
            const { course } = await api<{ course: { id: string } }>('/api/courses', { method: 'POST', body: values });
            router.push(`/trainer/courses/${course.id}`);
          }}
        />
      </Card>
    </>
  );
}
