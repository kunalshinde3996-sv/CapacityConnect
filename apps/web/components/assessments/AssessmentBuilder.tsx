'use client';

import { useState } from 'react';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { useSubmit } from '@/lib/useSubmit';

export interface BuilderQuestion {
  text: string;
  competencyId: string;
  options: string[];
  correctIndex: number;
  marks: number;
  explanation: string;
}

export interface BuilderValues {
  title: string;
  description: string;
  deadline: string; // datetime-local value, e.g. 2026-10-05T17:00
  durationMinutes: string;
  passPercent: string;
  questions: BuilderQuestion[];
}

const emptyQuestion = (competencyId = ''): BuilderQuestion => ({
  text: '',
  competencyId,
  options: ['', '', '', ''],
  correctIndex: 0,
  marks: 1,
  explanation: '',
});

// Converts an ISO date to the local "YYYY-MM-DDTHH:mm" a datetime-local input expects.
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The questionnaire editor used to create and edit an assessment. Every question is
// tagged with one of the course's competencies, so results can be reported per competency.
export function AssessmentBuilder({
  competencies,
  initial,
  submitLabel,
  onSubmit,
}: {
  competencies: { id: string; name: string }[];
  initial?: BuilderValues;
  submitLabel: string;
  onSubmit: (body: object) => Promise<unknown>;
}) {
  const [v, setV] = useState<BuilderValues>(
    initial ?? { title: '', description: '', deadline: '', durationMinutes: '', passPercent: '50', questions: [emptyQuestion(competencies[0]?.id)] },
  );
  const { busy, error, run } = useSubmit();
  const setQ = (i: number, patch: Partial<BuilderQuestion>) => setV({ ...v, questions: v.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  // How many questions test each competency (the level rule needs at least 2)
  const perCompetency = competencies.map((c) => ({ ...c, count: v.questions.filter((q) => q.competencyId === c.id).length }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await run(() =>
      onSubmit({
        title: v.title,
        description: v.description || undefined,
        deadline: new Date(v.deadline).toISOString(),
        durationMinutes: v.durationMinutes ? Number(v.durationMinutes) : null,
        passPercent: Number(v.passPercent),
        questions: v.questions.map((q) => ({
          text: q.text,
          competencyId: q.competencyId,
          options: q.options.map((o) => o.trim()),
          correctIndex: q.correctIndex,
          marks: q.marks,
          explanation: q.explanation || undefined,
        })),
      }),
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card title="Settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title">
              <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required minLength={3} maxLength={150} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Instructions (optional)">
              <Textarea rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={2000} />
            </Field>
          </div>
          <Field label="Deadline">
            <Input type="datetime-local" value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} required />
          </Field>
          <Field label="Time limit in minutes" hint="Optional; counted from when the trainee starts">
            <Input type="number" min={5} max={300} value={v.durationMinutes} onChange={(e) => setV({ ...v, durationMinutes: e.target.value })} />
          </Field>
          <Field label="Pass mark (%)">
            <Input type="number" min={0} max={100} value={v.passPercent} onChange={(e) => setV({ ...v, passPercent: e.target.value })} required />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
          {perCompetency.map((c) => (
            <span key={c.id} className={`rounded-full px-2 py-0.5 ring-1 ring-inset ${c.count >= 2 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
              {c.name}: {c.count} question{c.count === 1 ? '' : 's'}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">A trainee&apos;s skill level is only updated for competencies with at least 2 questions.</p>
      </Card>

      {v.questions.map((q, i) => (
        <Card
          key={i}
          title={`Question ${i + 1}`}
          action={
            v.questions.length > 1 && (
              <Button variant="danger" className="min-h-8 px-3" onClick={() => setV({ ...v, questions: v.questions.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_14rem_6rem]">
            <Field label="Question">
              <Textarea rows={2} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} required minLength={5} maxLength={1000} />
            </Field>
            <Field label="Competency tested">
              <Select value={q.competencyId} onChange={(e) => setQ(i, { competencyId: e.target.value })} required>
                <option value="" disabled>Choose…</option>
                {competencies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Marks">
              <Input type="number" min={1} max={10} value={q.marks} onChange={(e) => setQ(i, { marks: Number(e.target.value) })} />
            </Field>
          </div>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-slate-700">Options (select the correct one)</legend>
            <ul className="mt-2 space-y-2">
              {q.options.map((opt, j) => (
                <li key={j} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${i}`}
                    checked={q.correctIndex === j}
                    onChange={() => setQ(i, { correctIndex: j })}
                    aria-label={`Option ${j + 1} is correct`}
                    className="size-5 shrink-0 accent-brand-600"
                  />
                  <Input
                    value={opt}
                    onChange={(e) => setQ(i, { options: q.options.map((o, k) => (k === j ? e.target.value : o)) })}
                    placeholder={`Option ${j + 1}`}
                    required
                    maxLength={300}
                    className="mt-0"
                  />
                  {q.options.length > 2 && (
                    <Button
                      variant="secondary"
                      className="min-h-8 shrink-0 px-2"
                      aria-label={`Remove option ${j + 1}`}
                      onClick={() => setQ(i, { options: q.options.filter((_, k) => k !== j), correctIndex: shiftCorrect(q.correctIndex, j) })}
                    >
                      ✕
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {q.options.length < 6 && (
              <Button variant="secondary" className="mt-2 min-h-8 px-3" onClick={() => setQ(i, { options: [...q.options, ''] })}>
                Add option
              </Button>
            )}
          </fieldset>

          <div className="mt-4">
            <Field label="Explanation (shown after submission)">
              <Input value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} maxLength={1000} />
            </Field>
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setV({ ...v, questions: [...v.questions, emptyQuestion(v.questions.at(-1)?.competencyId)] })}>
          Add question
        </Button>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
      {error && <Alert>{error}</Alert>}
    </form>
  );
}

// After removing option number `removed`, keep pointing at the same correct option
// (or the first option if the correct one itself was removed).
function shiftCorrect(correct: number, removed: number) {
  if (removed === correct) return 0;
  return removed < correct ? correct - 1 : correct;
}
