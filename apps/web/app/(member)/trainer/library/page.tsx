'use client';

import { useCallback, useEffect, useState } from 'react';
import { LibraryList } from '@/components/library/LibraryList';
import { UploadForm } from '@/components/library/UploadForm';
import { Alert, Button, Card, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { LibraryItem } from '@/lib/library';
import { useSubmit } from '@/lib/useSubmit';

// A trainer's own uploads: upload new material, hide/show or delete existing items.
export default function MyLibraryPage() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const action = useSubmit();

  const show = useCallback((d: { items: LibraryItem[] }) => setItems(d.items), []);
  const fail = useCallback((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load your uploads'), []);
  const reload = useCallback(() => api<{ items: LibraryItem[] }>('/api/library?mine=true').then(show).catch(fail), [show, fail]);
  useEffect(() => {
    api<{ items: LibraryItem[] }>('/api/library?mine=true').then(show).catch(fail);
  }, [show, fail]);

  return (
    <>
      <PageHeader title="My uploads" description="Upload lectures, slides and notes. Tag each one with the competencies it teaches." />
      <div className="space-y-6">
        <Card title="Upload new material">
          <UploadForm onUploaded={reload} />
        </Card>
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your material</h2>
          {error && <Alert>{error}</Alert>}
          {action.error && <div className="mb-3"><Alert>{action.error}</Alert></div>}
          {!items && !error && <Spinner />}
          {items && (
            <LibraryList
              items={items}
              empty="You have not uploaded anything yet."
              actions={(item) => (
                <>
                  <Button variant="secondary" className="min-h-8 px-3" disabled={action.busy}
                    onClick={() => action.run(async () => {
                      await api(`/api/library/${item.id}`, { method: 'PATCH', body: { isPublished: !item.isPublished } });
                      await reload();
                    })}>
                    {item.isPublished ? 'Hide' : 'Show'}
                  </Button>
                  <Button variant="danger" className="min-h-8 px-3" disabled={action.busy}
                    onClick={() => action.run(async () => {
                      await api(`/api/library/${item.id}`, { method: 'DELETE' });
                      await reload();
                    })}>
                    Delete
                  </Button>
                </>
              )}
            />
          )}
        </section>
      </div>
    </>
  );
}
