'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { type AttemptSummary, formatDateTime, timeLeft, type TraineeQuestion } from '@/lib/assessments';

interface TraineeAssessment {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  durationMinutes: number | null;
  passPercent: number;
  course: { id: string; title: string };
  competencies: { id: string; name: string }[];
  questionCount: number;
  myAttempt: (AttemptSummary & { endsAt: string }) | null;
  questions: TraineeQuestion[];
}

// Answers survive a page reload (common on phones) via sessionStorage.
const storageKey = (id: string) => `cc-answers-${id}`;
function loadAnswers(id: string): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(id)) ?? '{}');
  } catch {
    return {};
  }
}
function saveAnswers(id: string, answers: Record<string, string>) {
  try {
    sessionStorage.setItem(storageKey(id), JSON.stringify(answers));
  } catch {
    /* storage unavailable (private mode): answers just stay in memory */
  }
}

function formatRemaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  // Far-away deadline (no time limit): days and hours read better than 340:12:05
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h left`;
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export default function TakeAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [assessment, setAssessment] = useState<TraineeAssessment | null>(null);
  const [attempt, setAttempt] = useState<{ endsAt: string; questions: TraineeQuestion[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    api<{ assessment: TraineeAssessment }>(`/api/assessments/${id}`)
      .then(({ assessment }) => {
        setAssessment(assessment);
        // Resuming an attempt that is already running
        if (assessment.myAttempt && !assessment.myAttempt.submittedAt) {
          setAttempt({ endsAt: assessment.myAttempt.endsAt, questions: assessment.questions });
          setAnswers(loadAnswers(id));
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the assessment'));
  }, [id]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/assessments/${id}/submit`, { method: 'POST', body: { answers } });
      try {
        sessionStorage.removeItem(storageKey(id));
      } catch {
        /* ignore */
      }
      router.replace(`/assessments/${id}/result`);
    } catch (err) {
      submitted.current = false;
      setBusy(false);
      setError(err instanceof ApiError ? err.message : 'Could not submit. Check your connection and try again.');
    }
  }, [id, answers, router]);

  // Countdown; submits automatically when time is up.
  const endsAt = attempt ? new Date(attempt.endsAt).getTime() : null;
  useEffect(() => {
    if (!endsAt) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) submit();
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt, submit]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const started = await api<{ endsAt: string; questions: TraineeQuestion[] }>(`/api/assessments/${id}/start`, { method: 'POST' });
      setAttempt(started);
      setAnswers(loadAnswers(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start');
    } finally {
      setBusy(false);
    }
  }

  function choose(questionId: string, optionId: string) {
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    saveAnswers(id, next);
  }

  if (!assessment) return error ? <Alert>{error}</Alert> : <Spinner />;

  const back = (
    <Link href={`/courses/${assessment.course.id}`} className="text-sm font-medium text-brand-600 hover:underline">
      ← {assessment.course.title}
    </Link>
  );

  // ── Already submitted ──
  if (assessment.myAttempt?.submittedAt) {
    return (
      <>
        {back}
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{assessment.title}</h1>
        <div className="mt-4">
          <Alert tone="green">
            You submitted this assessment. <Link href={`/assessments/${id}/result`} className="font-semibold underline">See your result</Link>
          </Alert>
        </div>
      </>
    );
  }

  // ── Intro, before starting ──
  if (!attempt) {
    const closed = new Date(assessment.deadline).getTime() < now;
    return (
      <>
        {back}
        <h1 className="mt-3 mb-5 text-2xl font-bold text-slate-900">{assessment.title}</h1>
        <Card title="Before you start">
          {assessment.description && <p className="mb-4 whitespace-pre-line text-sm text-slate-700">{assessment.description}</p>}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Deadline</dt><dd className="font-medium">{formatDateTime(assessment.deadline)} ({timeLeft(assessment.deadline, now)})</dd></div>
            <div><dt className="text-slate-500">Questions</dt><dd className="font-medium">{assessment.questionCount}</dd></div>
            <div><dt className="text-slate-500">Time limit</dt><dd className="font-medium">{assessment.durationMinutes ? `${assessment.durationMinutes} minutes once you start` : 'None (until the deadline)'}</dd></div>
            <div><dt className="text-slate-500">Pass mark</dt><dd className="font-medium">{assessment.passPercent}%</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {assessment.competencies.map((c) => <Badge key={c.id} tone="brand">{c.name}</Badge>)}
          </div>
          <p className="mt-4 text-sm text-slate-600">You get <b>one attempt</b>. Your answers are scored on the server and your skill levels are updated from the result.</p>
          <div className="mt-5">
            {closed ? <Alert tone="amber">The deadline has passed.</Alert> : <Button onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Start assessment'}</Button>}
          </div>
          {error && <div className="mt-3"><Alert>{error}</Alert></div>}
        </Card>
      </>
    );
  }

  // ── Answering ──
  const remaining = (endsAt ?? 0) - now;
  const answered = attempt.questions.filter((q) => answers[q.id]).length;
  return (
    <>
      {back}
      {/* Sticky bar: always shows time left and progress, also on a phone */}
      <div className="sticky top-0 z-10 -mx-4 mt-3 mb-4 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{assessment.title}</p>
          <p className="text-xs text-slate-600">{answered} of {attempt.questions.length} answered</p>
        </div>
        <div className={`rounded-lg px-3 py-1.5 font-mono text-sm font-semibold tabular-nums ${remaining < 5 * 60_000 ? 'bg-red-100 text-red-700' : 'bg-white text-slate-800 ring-1 ring-slate-200'}`} role="timer" aria-live="off">
          {formatRemaining(remaining)}
        </div>
      </div>

      <ol className="space-y-4">
        {attempt.questions.map((q, i) => (
          <li key={q.id}>
            <fieldset className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
              <legend className="sr-only">Question {i + 1}</legend>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Question {i + 1} · {q.competency.name} · {q.marks} mark{q.marks === 1 ? '' : 's'}
              </p>
              <p className="mt-1 font-medium text-slate-900">{q.text}</p>
              <div className="mt-3 space-y-2">
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ring-1 ring-inset ${answers[q.id] === o.id ? 'bg-brand-50 ring-brand-600' : 'ring-slate-200 hover:bg-slate-50'}`}
                  >
                    <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => choose(q.id, o.id)} className="size-4 shrink-0 accent-brand-600" />
                    {o.text}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-3">
        {answered < attempt.questions.length && (
          <Alert tone="amber">{attempt.questions.length - answered} question(s) unanswered. Unanswered questions score zero.</Alert>
        )}
        {error && <Alert>{error}</Alert>}
        <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">
          {busy ? 'Submitting…' : 'Submit answers'}
        </Button>
      </div>
    </>
  );
}
