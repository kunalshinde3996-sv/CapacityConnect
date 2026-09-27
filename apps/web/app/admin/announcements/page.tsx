'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Field, formatDate, Input, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useSubmit } from '@/lib/useSubmit';

type AnnouncementType = 'NOTICE' | 'ACHIEVEMENT' | 'NEW_CONTENT';

interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string;
  linkUrl: string | null;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
  createdBy: { fullName: string };
}

const TYPE_LABELS: Record<AnnouncementType, string> = { NOTICE: 'Announcement', ACHIEVEMENT: 'Achievement', NEW_CONTENT: 'New content' };
const empty = { type: 'NOTICE' as AnnouncementType, title: '', body: '', linkUrl: '' };

// Admin: write, edit, publish and unpublish homepage announcements.
export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null);
  const action = useSubmit();

  const show = useCallback((d: { announcements: Announcement[] }) => setItems(d.announcements), []);
  const fail = useCallback((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load announcements'), []);
  const reload = useCallback(() => api<{ announcements: Announcement[] }>('/api/announcements').then(show).catch(fail), [show, fail]);
  useEffect(() => {
    api<{ announcements: Announcement[] }>('/api/announcements').then(show).catch(fail);
  }, [show, fail]);

  return (
    <>
      <PageHeader title="Announcements" description="Shown on the public homepage once published.">
        {editing === null && <Button onClick={() => setEditing('new')}>New announcement</Button>}
      </PageHeader>
      {error && <Alert>{error}</Alert>}
      {action.error && <div className="mb-4"><Alert>{action.error}</Alert></div>}

      {editing && (
        <div className="mb-6">
          <AnnouncementForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? null : editing}
            onDone={async (changed) => {
              setEditing(null);
              if (changed) await reload();
            }}
          />
        </div>
      )}

      {!items && !error && <Spinner />}
      {items?.length === 0 && <EmptyState>No announcements yet.</EmptyState>}
      <ul className="space-y-3">
        {items?.map((a) => (
          <li key={a.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.published ? 'green' : 'amber'}>{a.published ? 'Published' : 'Draft'}</Badge>
                  <Badge>{TYPE_LABELS[a.type]}</Badge>
                </div>
                <p className="mt-2 font-semibold text-slate-900">{a.title}</p>
                <p className="mt-1 text-sm text-slate-700">{a.body}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {a.createdBy.fullName} · {a.published && a.publishedAt ? `published ${formatDate(a.publishedAt)}` : `edited ${formatDate(a.updatedAt)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <Button variant="secondary" onClick={() => setEditing(a)} disabled={action.busy}>Edit</Button>
                <Button
                  variant={a.published ? 'danger' : 'primary'}
                  disabled={action.busy}
                  onClick={() => action.run(async () => {
                    await api(`/api/announcements/${a.id}/${a.published ? 'unpublish' : 'publish'}`, { method: 'POST' });
                    await reload();
                  })}
                >
                  {a.published ? 'Unpublish' : 'Publish'}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function AnnouncementForm({ initial, onDone }: { initial: Announcement | null; onDone: (changed: boolean) => void }) {
  const [v, setV] = useState(initial ? { type: initial.type, title: initial.title, body: initial.body, linkUrl: initial.linkUrl ?? '' } : empty);
  const { busy, error, run } = useSubmit();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...v, linkUrl: v.linkUrl || null };
    const ok = await run(() =>
      initial ? api(`/api/announcements/${initial.id}`, { method: 'PUT', body }) : api('/api/announcements', { method: 'POST', body }),
    );
    if (ok) onDone(true);
  }

  return (
    <Card title={initial ? 'Edit announcement' : 'New announcement'} description={initial ? undefined : 'Saved as a draft. Publish it from the list.'}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind">
          <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as AnnouncementType })}>
            {(Object.keys(TYPE_LABELS) as AnnouncementType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Link (optional)" hint="An in-app path like /courses, or an https:// address">
          <Input value={v.linkUrl} onChange={(e) => setV({ ...v, linkUrl: e.target.value })} maxLength={500} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Title">
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required minLength={3} maxLength={150} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Text">
            <Textarea rows={3} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} required minLength={10} maxLength={4000} />
          </Field>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          <Button variant="secondary" onClick={() => onDone(false)}>Cancel</Button>
        </div>
        {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
      </form>
    </Card>
  );
}
