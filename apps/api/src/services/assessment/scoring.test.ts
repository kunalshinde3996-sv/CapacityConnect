import { describe, expect, it } from 'vitest';
import { type CompetencyResult, type CompetencySource, levelForPercent, levelUpdates, scoreAttempt, strengthOf } from './scoring.js';

// 5 questions: 3 on radar (1 mark each), 2 on nowcasting (2 marks each)
const questions = [
  { id: 'q1', competencyId: 'radar', correctOptionId: 'a', marks: 1 },
  { id: 'q2', competencyId: 'radar', correctOptionId: 'b', marks: 1 },
  { id: 'q3', competencyId: 'nowcast', correctOptionId: 'c', marks: 2 },
  { id: 'q4', competencyId: 'radar', correctOptionId: 'd', marks: 1 },
  { id: 'q5', competencyId: 'nowcast', correctOptionId: 'a', marks: 2 },
];

describe('scoreAttempt', () => {
  it('scores total and per-competency results', () => {
    const r = scoreAttempt(questions, { q1: 'a', q2: 'b', q3: 'x', q4: 'd', q5: 'a' });

    expect(r.score).toBe(5); // radar 3/3 + nowcast 2/4
    expect(r.maxScore).toBe(7);
    expect(r.percent).toBe(71.4);
    expect(r.competencyResults).toEqual([
      { competencyId: 'radar', questions: 3, correct: 3, marksObtained: 3, maxMarks: 3, percent: 100 },
      { competencyId: 'nowcast', questions: 2, correct: 1, marksObtained: 2, maxMarks: 4, percent: 50 },
    ]);
  });

  it('counts unanswered questions as wrong and ignores answers to unknown questions', () => {
    const r = scoreAttempt(questions, { q1: 'a', hacked: 'a' });
    expect(r.score).toBe(1);
    expect(r.answers.find((a) => a.questionId === 'q2')).toMatchObject({ selectedOptionId: null, correct: false, marks: 0 });
    expect(r.answers).toHaveLength(5);
  });

  it('weights per-competency percent by marks, not just question count', () => {
    // nowcast: q3 right (2 marks), q5 wrong -> 50% by marks
    const r = scoreAttempt(questions, { q3: 'c' });
    expect(r.competencyResults.find((c) => c.competencyId === 'nowcast')!.percent).toBe(50);
  });

  it('handles an empty submission', () => {
    const r = scoreAttempt(questions, {});
    expect(r.score).toBe(0);
    expect(r.percent).toBe(0);
  });
});

describe('strong / weak summary', () => {
  it.each([
    [100, 'STRONG'],
    [80, 'STRONG'],
    [79.9, 'DEVELOPING'],
    [50, 'DEVELOPING'],
    [49.9, 'WEAK'],
    [0, 'WEAK'],
  ] as const)('%s%% is %s', (percent, expected) => {
    expect(strengthOf(percent)).toBe(expected);
  });
});

describe('skill-level rule', () => {
  it.each([
    [100, 3],
    [80, 3],
    [79.9, 2],
    [50, 2],
    [49.9, 1],
    [0, 1],
  ] as const)('%s%% -> level %s (never 4 from an MCQ)', (percent, level) => {
    expect(levelForPercent(percent)).toBe(level);
  });

  const result = (competencyId: string, percent: number, questions = 3): CompetencyResult => ({
    competencyId,
    questions,
    correct: 0,
    marksObtained: 0,
    maxMarks: 0,
    percent,
  });
  const current = (entries: [string, number, CompetencySource][]) =>
    new Map(entries.map(([id, level, source]) => [id, { level, source }]));

  it('ignores competencies with fewer than 2 questions', () => {
    const changes = levelUpdates([result('radar', 100, 1), result('nowcast', 100, 2)], current([]));
    expect(changes.map((c) => c.competencyId)).toEqual(['nowcast']);
  });

  it('creates a level when there was none', () => {
    const [c] = levelUpdates([result('radar', 85)], current([]));
    expect(c).toMatchObject({ before: null, after: 3, levelChanged: true, write: true });
  });

  it('replaces a self-assessed level, up or down (measured beats self-declared)', () => {
    const changes = levelUpdates([result('radar', 90), result('nowcast', 30)], current([['radar', 1, 'SELF_ASSESSED'], ['nowcast', 3, 'SELF_ASSESSED']]));
    expect(changes.map((c) => [c.before, c.after, c.write])).toEqual([
      [1, 3, true],
      [3, 1, true],
    ]);
  });

  it('replaces an earlier assessment level', () => {
    const [c] = levelUpdates([result('radar', 60)], current([['radar', 3, 'ASSESSMENT']]));
    expect(c).toMatchObject({ before: 3, after: 2, write: true });
  });

  it('never lowers a level set by an admin or by course completion', () => {
    const changes = levelUpdates(
      [result('radar', 20), result('nowcast', 55)],
      current([['radar', 3, 'ADMIN_ASSIGNED'], ['nowcast', 2, 'COURSE_COMPLETION']]),
    );
    expect(changes[0]).toMatchObject({ before: 3, after: 3, write: false, levelChanged: false });
    expect(changes[0]!.reason).toMatch(/never lowered/);
    expect(changes[1]).toMatchObject({ before: 2, after: 2, write: false }); // equal: keep the protected source
  });

  it('can raise a protected level when the test shows more', () => {
    const [c] = levelUpdates([result('radar', 95)], current([['radar', 1, 'ADMIN_ASSIGNED']]));
    expect(c).toMatchObject({ before: 1, after: 3, write: true });
  });
});
