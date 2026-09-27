// Assessment scoring and the skill-level update rule. Pure functions (no database),
// so every rule is easy to unit test and the seed can reuse them.

export interface ScoringQuestion {
  id: string;
  competencyId: string;
  correctOptionId: string;
  marks: number;
}

export interface AnswerRecord {
  questionId: string;
  competencyId: string;
  selectedOptionId: string | null; // null = left blank
  correct: boolean;
  marks: number; // marks obtained (0 if wrong)
}

export interface CompetencyResult {
  competencyId: string;
  questions: number;
  correct: number;
  marksObtained: number;
  maxMarks: number;
  percent: number; // marksObtained / maxMarks, 0-100, rounded to 1 decimal
}

export interface ScoreResult {
  score: number;
  maxScore: number;
  percent: number;
  answers: AnswerRecord[];
  competencyResults: CompetencyResult[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Scores a submission. Answers for unknown questions are ignored; unanswered = wrong.
export function scoreAttempt(questions: ScoringQuestion[], submitted: Record<string, string | null | undefined>): ScoreResult {
  const answers: AnswerRecord[] = questions.map((q) => {
    const selected = submitted[q.id] ?? null;
    const correct = selected === q.correctOptionId;
    return { questionId: q.id, competencyId: q.competencyId, selectedOptionId: selected, correct, marks: correct ? q.marks : 0 };
  });

  // Group per competency, in the order competencies first appear in the questionnaire.
  const groups = new Map<string, CompetencyResult>();
  for (const [i, a] of answers.entries()) {
    const g = groups.get(a.competencyId) ?? { competencyId: a.competencyId, questions: 0, correct: 0, marksObtained: 0, maxMarks: 0, percent: 0 };
    g.questions += 1;
    g.correct += a.correct ? 1 : 0;
    g.marksObtained += a.marks;
    g.maxMarks += questions[i]!.marks;
    groups.set(a.competencyId, g);
  }
  const competencyResults = [...groups.values()].map((g) => ({ ...g, percent: g.maxMarks ? round1((g.marksObtained / g.maxMarks) * 100) : 0 }));

  const score = answers.reduce((s, a) => s + a.marks, 0);
  const maxScore = questions.reduce((s, q) => s + q.marks, 0);
  return { score, maxScore, percent: maxScore ? round1((score / maxScore) * 100) : 0, answers, competencyResults };
}

// ── Strong / weak summary ──────────────────────────────────

export const STRONG_PERCENT = 80;
export const WEAK_PERCENT = 50;

export function strengthOf(percent: number): 'STRONG' | 'DEVELOPING' | 'WEAK' {
  if (percent >= STRONG_PERCENT) return 'STRONG';
  if (percent >= WEAK_PERCENT) return 'DEVELOPING';
  return 'WEAK';
}

// ── Skill-level update rule (agreed with the team) ─────────
//
//  1. Only competencies with at least MIN_QUESTIONS questions count, so a single
//     lucky (or unlucky) answer never changes a level.
//  2. Score >= 80% -> Level 3 Proficient, 50-79% -> Level 2 Working, < 50% -> Level 1 Aware.
//     An MCQ test never awards Level 4 Expert.
//  3. The measured level replaces a self-assessed or earlier assessment level (it is better
//     evidence), but never LOWERS a level set by an admin or by course completion.

export const MIN_QUESTIONS_FOR_LEVEL = 2;

export function levelForPercent(percent: number): 1 | 2 | 3 {
  if (percent >= 80) return 3;
  if (percent >= 50) return 2;
  return 1;
}

export type CompetencySource = 'SELF_ASSESSED' | 'ASSESSMENT' | 'COURSE_COMPLETION' | 'ADMIN_ASSIGNED';

export interface LevelChange {
  competencyId: string;
  before: number | null;
  beforeSource: CompetencySource | null;
  measured: 1 | 2 | 3;
  after: number;
  levelChanged: boolean; // after !== before
  write: boolean; // save `after` with source ASSESSMENT (false = keep the protected level)
  reason: string;
}

export function levelUpdates(
  results: CompetencyResult[],
  current: Map<string, { level: number; source: CompetencySource }>,
): LevelChange[] {
  return results
    .filter((r) => r.questions >= MIN_QUESTIONS_FOR_LEVEL)
    .map((r) => {
      const measured = levelForPercent(r.percent);
      const existing = current.get(r.competencyId) ?? null;
      const protectedSource = existing && (existing.source === 'ADMIN_ASSIGNED' || existing.source === 'COURSE_COMPLETION');

      const base = { competencyId: r.competencyId, before: existing?.level ?? null, beforeSource: existing?.source ?? null, measured };

      // A protected level stays unless the test shows a HIGHER level.
      if (protectedSource && measured <= existing.level) {
        const by = existing.source === 'ADMIN_ASSIGNED' ? 'an admin' : 'course completion';
        return {
          ...base,
          after: existing.level,
          levelChanged: false,
          write: false,
          reason:
            measured < existing.level
              ? `${r.percent}% suggests level ${measured}, but level ${existing.level} set by ${by} is never lowered`
              : `${r.percent}% confirms level ${existing.level} set by ${by}`,
        };
      }
      return {
        ...base,
        after: measured,
        levelChanged: measured !== existing?.level,
        write: true,
        reason: `${r.percent}% on ${r.questions} questions → level ${measured}`,
      };
    });
}
