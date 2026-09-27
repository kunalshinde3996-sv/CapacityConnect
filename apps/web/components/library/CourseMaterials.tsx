'use client';

import { useEffect, useState } from 'react';
import { Card, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import type { LibraryItem } from '@/lib/library';
import { LibraryList } from './LibraryList';

// Library items attached to one course, shown on the course page.
export function CourseMaterials({ courseId, refreshKey = 0, actions }: { courseId: string; refreshKey?: number; actions?: (item: LibraryItem) => React.ReactNode }) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  useEffect(() => {
    api<{ items: LibraryItem[] }>(`/api/library?courseId=${courseId}`).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [courseId, refreshKey]);

  return (
    <Card title="Course materials" description="Lectures, slides and notes for this course.">
      {items ? <LibraryList items={items} empty="No materials uploaded for this course yet." actions={actions} /> : <Spinner />}
    </Card>
  );
}
