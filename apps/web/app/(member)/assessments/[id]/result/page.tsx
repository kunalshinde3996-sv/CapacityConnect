'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, LEVEL_NAMES, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { type AssessmentResult, formatDateTime, STRENGTH } from '@/lib/assessments';

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ result: AssessmentResult }>(`/api/assessments/${id}/result`)
      .then((d) => setResult(d.result))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your result'));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!result) return <Spinner />;

  const levelChanges = result.competencies.filter((c) => c.level);

  return (
    <>
      <Link href={`/courses/${result.assessment.course.id}`} className="text-sm font-medium text-brand-600 hover:underline">
        ← {result.assessment.course.title}
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{result.assessment.title}</h1>
      <p className="mt-1 text-sm text-slate-500">Submitted {formatDateTime(result.submittedAt)}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card title="Your score">
          <p className="text-4xl font-bold tabular-nums text-slate-900">{result.percent}%</p>
          <p className="mt-1 text-sm text-slate-600">
            {result.score} of {result.maxScore} marks · pass mark {result.assessment.passPercent}%
          </p>
          <div className="mt-3">
            <Badge tone={result.passed ? 'green' : 'red'}>{result.passed ? 'Passed' : 'Not passed'}</Badge>
          </div>
          {(result.strongIn.length > 0 || result.weakIn.length > 0) && (
            <p className="mt-4 text-sm text-slate-700">
              {result.strongIn.length > 0 && <>Strong in <b>{list(result.strongIn)}</b>. </>}
              {result.weakIn.length > 0 && <>Needs work in <b>{list(result.weakIn)}</b>.</>}
            </p>
          )}
        </Card>

        <Card title="By competency" description="Strong ≥ 80%, developing 50–79%, needs work < 50%.">
          <ul className="space-y-4">
            {result.competencies.map((c) => {
              const s = STRENGTH[c.strength];
              return (
                <li key={c.competencyId}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-900">{c.competencyName}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-slate-600">{c.correct}/{c.questions} correct · {c.percent}%</span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${c.percent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {levelChanges.length > 0 && (
        <div className="mt-5">
          <Card title="Your skill levels" description="Updated from this result. Only competencies with 2 or more questions count.">
            <ul className="space-y-2 text-sm">
              {levelChanges.map((c) => (
                <li key={c.competencyId} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-slate-900">{c.competencyName}</span>
                  <span className="text-slate-700">
                    {c.level!.before ? `L${c.level!.before}` : 'not set'} → <b>L{c.level!.after} {LEVEL_NAMES[c.level!.after]}</b>
                    <span className="block text-xs text-slate-500 sm:inline sm:pl-2">{c.level!.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Review your answers</h2>
      <ol className="space-y-3">
        {result.questions.map((q, i) => (
          <li key={q.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Question {i + 1} · {q.competency.name}</p>
              <Badge tone={q.correct ? 'green' : 'red'}>{q.correct ? 'Correct' : q.selectedOptionId ? 'Wrong' : 'Not answered'}</Badge>
            </div>
            <p className="mt-1 font-medium text-slate-900">{q.text}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {q.options.map((o) => {
                const isCorrect = o.id === q.correctOptionId;
                const isMine = o.id === q.selectedOptionId;
                return (
                  <li key={o.id} className={isCorrect ? 'font-semibold text-emerald-700' : isMine ? 'text-red-700 line-through' : 'text-slate-600'}>
                    {isCorrect ? '✓ ' : isMine ? '✗ ' : '• '}
                    {o.text}
                    {isMine && ' (your answer)'}
                  </li>
                );
              })}
            </ul>
            {q.explanation && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{q.explanation}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}
