'use client';

import { useState } from 'react';
import { useSubmit } from '@/lib/useSubmit';
import { Alert, Button, EmptyState, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';
import type { CourseModule } from '@/lib/courses';

// Add, rename, reorder and delete a course's modules.
export function ModulesEditor({ courseId, modules, onChanged }: { courseId: string; modules: CourseModule[]; onChanged: () => void }) {
  const [adding, setAdding] = useState({ title: '', description: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const base = `/api/courses/${courseId}/modules`;

  const act = async (fn: () => Promise<unknown>) => (await run(fn)) && onChanged();

  return (
    <div className="space-y-4">
      {modules.length === 0 && <EmptyState>No modules yet. A course needs at least one module before it can be published.</EmptyState>}
      <ol className="space-y-2">
        {modules.map((m, i) =>
          editing === m.id ? (
            <li key={m.id}>
              <EditModule
                module={m}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={(v) => act(async () => {
                  await api(`${base}/${m.id}`, { method: 'PATCH', body: v });
                  setEditing(null);
                })}
              />
            </li>
          ) : (
            <li key={m.id} className="flex flex-col gap-2 rounded-lg px-3 py-2 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                <div>
                  <p className="font-medium text-slate-900">{m.title}</p>
                  {m.description && <p className="text-sm text-slate-600">{m.description}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="secondary" className="min-h-8 px-3" disabled={busy || i === 0} aria-label={`Move ${m.title} up`}
                  onClick={() => act(() => api(`${base}/${m.id}/move`, { method: 'POST', body: { direction: 'UP' } }))}>
                  ↑
                </Button>
                <Button variant="secondary" className="min-h-8 px-3" disabled={busy || i === modules.length - 1} aria-label={`Move ${m.title} down`}
                  onClick={() => act(() => api(`${base}/${m.id}/move`, { method: 'POST', body: { direction: 'DOWN' } }))}>
                  ↓
                </Button>
                <Button variant="secondary" className="min-h-8 px-3" disabled={busy} onClick={() => setEditing(m.id)}>Edit</Button>
                <Button variant="danger" className="min-h-8 px-3" disabled={busy}
                  onClick={() => act(() => api(`${base}/${m.id}`, { method: 'DELETE' }))}>
                  Delete
                </Button>
              </div>
            </li>
          ),
        )}
      </ol>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await act(async () => {
            await api(base, { method: 'POST', body: { title: adding.title, description: adding.description || undefined } });
            setAdding({ title: '', description: '' });
          });
        }}
        className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field label="New module title">
          <Input value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} required minLength={2} maxLength={150} />
        </Field>
        <Field label="Short description (optional)">
          <Input value={adding.description} onChange={(e) => setAdding({ ...adding, description: e.target.value })} maxLength={2000} />
        </Field>
        <Button type="submit" disabled={busy}>Add module</Button>
      </form>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

function EditModule({ module, busy, onSave, onCancel }: { module: CourseModule; busy: boolean; onSave: (v: { title: string; description?: string }) => void; onCancel: () => void }) {
  const [v, setV] = useState({ title: module.title, description: module.description ?? '' });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title: v.title, description: v.description || undefined });
      }}
      className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <Field label="Title">
        <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required minLength={2} />
      </Field>
      <Field label="Description">
        <Input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>Save</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
