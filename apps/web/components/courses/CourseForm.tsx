'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Field, Input, LEVEL_NAMES, Select, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import type { CourseDetail } from '@/lib/courses';
import type { Competency } from '@/lib/profile';
import { useSubmit } from '@/lib/useSubmit';

export interface CourseFormValues {
  title: string;
  description: string;
  subjectId: string | null;
  startDate?: string;
  endDate?: string;
  capacity: number | null;
  competencies: { competencyId: string; targetLevel: number }[];
}

interface SubjectOption {
  id: string;
  name: string;
  requirements: { competency: { id: string; name: string }; minLevel: number }[];
}

const toDateInput = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');

// Used both to create a course and to edit its details and competency tags.
export function CourseForm({ initial, submitLabel, onSubmit }: { initial?: CourseDetail; submitLabel: string; onSubmit: (v: CourseFormValues) => Promise<unknown> }) {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    subjectId: initial?.subjectId ?? '',
    startDate: toDateInput(initial?.startDate),
    endDate: toDateInput(initial?.endDate),
    capacity: initial?.capacity?.toString() ?? '',
  });
  const [tags, setTags] = useState(initial?.competencies.map((c) => ({ competencyId: c.competency.id, targetLevel: c.targetLevel })) ?? []);
  const [pick, setPick] = useState('');
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useSubmit();

  useEffect(() => {
    api<{ subjects: SubjectOption[] }>('/api/subjects').then((d) => setSubjects(d.subjects)).catch(() => {});
    api<{ competencies: Competency[] }>('/api/competencies').then((d) => setCompetencies(d.competencies)).catch(() => {});
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSaved(false);
    setForm({ ...form, [key]: e.target.value });
  };
  const name = (id: string) => competencies.find((c) => c.id === id)?.name ?? '…';

  // Picking a subject pre-fills its required competencies as course tags (they can be edited).
  function chooseSubject(e: React.ChangeEvent<HTMLSelectElement>) {
    set('subjectId')(e);
    const subject = subjects.find((s) => s.id === e.target.value);
    if (subject && tags.length === 0) {
      setTags(subject.requirements.map((r) => ({ competencyId: r.competency.id, targetLevel: r.minLevel })));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      onSubmit({
        title: form.title,
        description: form.description,
        subjectId: form.subjectId || null,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        capacity: form.capacity ? Number(form.capacity) : null,
        competencies: tags,
      }),
    );
    if (ok) setSaved(true);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Course title">
          <Input value={form.title} onChange={set('title')} required minLength={3} maxLength={150} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description" hint="What trainees will learn and who it is for">
          <Textarea value={form.description} onChange={set('description')} required minLength={10} maxLength={4000} rows={4} />
        </Field>
      </div>
      <Field label="Subject" hint="Links the course to trainer matching">
        <Select value={form.subjectId} onChange={chooseSubject}>
          <option value="">No subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Capacity" hint="Leave empty for unlimited seats">
        <Input type="number" min={1} max={1000} value={form.capacity} onChange={set('capacity')} />
      </Field>
      <Field label="Starts">
        <Input type="date" value={form.startDate} onChange={set('startDate')} />
      </Field>
      <Field label="Ends">
        <Input type="date" value={form.endDate} onChange={set('endDate')} />
      </Field>

      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-slate-700">Competencies this course builds</legend>
        <ul className="mt-2 space-y-2">
          {tags.map((t, i) => (
            <li key={t.competencyId} className="flex flex-col gap-2 rounded-lg px-3 py-2 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">{name(t.competencyId)}</span>
              <div className="flex items-center gap-2">
                <Select
                  aria-label={`Target level for ${name(t.competencyId)}`}
                  value={t.targetLevel}
                  onChange={(e) => setTags(tags.map((x, j) => (j === i ? { ...x, targetLevel: Number(e.target.value) } : x)))}
                  className="mt-0 sm:w-48"
                >
                  {[1, 2, 3, 4].map((l) => (
                    <option key={l} value={l}>target L{l} {LEVEL_NAMES[l]}</option>
                  ))}
                </Select>
                <Button variant="secondary" onClick={() => setTags(tags.filter((_, j) => j !== i))} aria-label={`Remove ${name(t.competencyId)}`}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Select aria-label="Add a competency" value={pick} onChange={(e) => setPick(e.target.value)} className="mt-0">
            <option value="">Add a competency…</option>
            {competencies
              .filter((c) => !tags.some((t) => t.competencyId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </Select>
          <Button
            variant="secondary"
            disabled={!pick}
            onClick={() => {
              setTags([...tags, { competencyId: pick, targetLevel: 2 }]);
              setPick('');
            }}
            className="shrink-0"
          >
            Add
          </Button>
        </div>
      </fieldset>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
        {saved && initial && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
    </form>
  );
}
