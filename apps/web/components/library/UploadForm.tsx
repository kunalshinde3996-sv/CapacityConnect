'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { api, apiUpload } from '@/lib/api';
import type { CourseDetail, CourseSummary } from '@/lib/courses';
import { ACCEPT, type LibraryType, TYPE_LABELS } from '@/lib/library';
import type { Competency } from '@/lib/profile';
import { useSubmit } from '@/lib/useSubmit';

// Upload a lecture, slides or notes. With `course`, the item is attached to that course
// (and optionally one of its modules); otherwise the trainer can pick one of their courses.
export function UploadForm({ course, onUploaded }: { course?: CourseDetail; onUploaded: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<LibraryType>('VIDEO');
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [tags, setTags] = useState<string[]>(course?.competencies.map((c) => c.competency.id) ?? []);
  const [pick, setPick] = useState('');
  const [myCourses, setMyCourses] = useState<CourseSummary[]>([]);
  const [courseId, setCourseId] = useState(course?.id ?? '');
  const [modules, setModules] = useState(course?.modules ?? []);
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();

  useEffect(() => {
    api<{ competencies: Competency[] }>('/api/competencies').then((d) => setCompetencies(d.competencies)).catch(() => {});
    if (!course) api<{ courses: CourseSummary[] }>('/api/courses?mine=true').then((d) => setMyCourses(d.courses)).catch(() => {});
  }, [course]);

  // Picking a course loads its modules (for the optional module link).
  function chooseCourse(id: string) {
    setCourseId(id);
    setModules([]);
    if (id) api<{ course: CourseDetail }>(`/api/courses/${id}`).then((d) => setModules(d.course.modules)).catch(() => {});
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set('competencyIds', JSON.stringify(tags));
    form.set('courseId', courseId);
    const title = String(form.get('title'));
    const ok = await run(() => apiUpload('/api/library', form));
    if (ok) {
      formRef.current?.reset();
      setDone(`“${title}” uploaded.`);
      onUploaded();
    }
  }

  const name = (id: string) => competencies.find((c) => c.id === id)?.name ?? '…';

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Title">
        <Input name="title" required minLength={3} maxLength={150} onChange={() => setDone(null)} />
      </Field>
      <Field label="Type">
        <Select name="type" value={type} onChange={(e) => setType(e.target.value as LibraryType)}>
          {(Object.keys(TYPE_LABELS) as LibraryType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="File" hint={`Allowed: ${ACCEPT[type].replaceAll(',', ', ')}. Videos play in the browser, no conversion.`}>
          <Input key={type} name="file" type="file" accept={ACCEPT[type]} required />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Short description (optional)">
          <Textarea name="description" rows={2} maxLength={1000} />
        </Field>
      </div>

      {!course && (
        <Field label="Course (optional)">
          <Select value={courseId} onChange={(e) => chooseCourse(e.target.value)}>
            <option value="">Not linked to a course</option>
            {myCourses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
        </Field>
      )}
      {courseId && (
        <Field label="Module (optional)">
          <Select name="moduleId" defaultValue="">
            <option value="">Whole course</option>
            {modules.map((m, i) => (
              <option key={m.id} value={m.id}>{i + 1}. {m.title}</option>
            ))}
          </Select>
        </Field>
      )}

      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-slate-700">Competencies (at least one)</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((id) => (
            <button key={id} type="button" onClick={() => setTags(tags.filter((t) => t !== id))} aria-label={`Remove ${name(id)}`}>
              <Badge tone="brand">{name(id)} ✕</Badge>
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Select aria-label="Add a competency tag" value={pick} onChange={(e) => setPick(e.target.value)} className="mt-0">
            <option value="">Add a competency…</option>
            {competencies.filter((c) => !tags.includes(c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Button variant="secondary" disabled={!pick} className="shrink-0" onClick={() => { setTags([...tags, pick]); setPick(''); }}>
            Add
          </Button>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy || tags.length === 0}>
          {busy ? 'Uploading… (large videos can take a minute)' : 'Upload'}
        </Button>
        {done && <span className="text-sm text-emerald-700">{done}</span>}
      </div>
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
    </form>
  );
}
