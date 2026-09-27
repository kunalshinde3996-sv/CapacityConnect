export interface Option {
  id: string;
  text: string;
}

export interface TraineeQuestion {
  id: string;
  order: number;
  text: string;
  marks: number;
  competency: { id: string; name: string };
  options: Option[];
}

export interface AttemptSummary {
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  endsAt?: string;
}

export interface AssessmentListItem {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  durationMinutes: number | null;
  passPercent: number;
  published: boolean;
  _count: { questions: number; attempts?: number };
  myAttempt?: AttemptSummary | null;
}

export type Strength = 'STRONG' | 'DEVELOPING' | 'WEAK';

export interface CompetencyOutcome {
  competencyId: string;
  competencyName: string;
  questions: number;
  correct: number;
  percent: number;
  strength: Strength;
  level: { before: number | null; after: number; measured: number; write: boolean; levelChanged: boolean; reason: string } | null;
}

export interface AssessmentResult {
  assessment: { id: string; title: string; passPercent: number; course: { id: string; title: string } };
  submittedAt: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  competencies: CompetencyOutcome[];
  strongIn: string[];
  weakIn: string[];
  questions: (TraineeQuestion & { correctOptionId: string; explanation: string | null; selectedOptionId: string | null; correct: boolean })[];
}

export const STRENGTH: Record<Strength, { label: string; tone: 'green' | 'amber' | 'red'; bar: string }> = {
  STRONG: { label: 'Strong', tone: 'green', bar: 'bg-emerald-500' },
  DEVELOPING: { label: 'Developing', tone: 'amber', bar: 'bg-amber-500' },
  WEAK: { label: 'Needs work', tone: 'red', bar: 'bg-red-500' },
};

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// "2 days left", "3 hours left", "closed"
export function timeLeft(deadline: string, now = Date.now()) {
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return 'closed';
  const hours = ms / 3_600_000;
  if (hours >= 48) return `${Math.floor(hours / 24)} days left`;
  if (hours >= 1) return `${Math.floor(hours)} hours left`;
  return `${Math.max(1, Math.floor(ms / 60_000))} minutes left`;
}

// Status of an assessment for the signed-in trainee
export function traineeStatus(a: Pick<AssessmentListItem, 'deadline' | 'myAttempt'>, now = Date.now()) {
  if (a.myAttempt?.submittedAt) return { key: 'SUBMITTED', label: 'Submitted', tone: 'green' as const };
  if (new Date(a.deadline).getTime() < now) return { key: 'MISSED', label: 'Missed', tone: 'red' as const };
  if (a.myAttempt) return { key: 'IN_PROGRESS', label: 'In progress', tone: 'amber' as const };
  return { key: 'NOT_STARTED', label: 'Not started', tone: 'brand' as const };
}
