import { describe, expect, it } from 'vitest';
import { computeTrainerFit, type Requirement } from './matching.js';
import { qualifies, teachingClaims } from './teachingEvidence.js';

const course = (ratings: number[], competencies: [string, number][], title = 'DWR Basics') => ({
  title,
  ratings,
  competencies: competencies.map(([competencyId, targetLevel]) => ({ competencyId, targetLevel })),
});

describe('qualifies', () => {
  it.each([
    [[5, 5], false], // fewer than 3 ratings
    [[4, 4, 4], true], // exactly the thresholds
    [[5, 4, 3], true], // average 4.0
    [[4, 4, 3], false], // average 3.67
    [[], false],
  ])('%j -> %s', (ratings, expected) => {
    expect(qualifies(ratings)).toBe(expected);
  });
});

describe('teachingClaims', () => {
  it('creates a TEACHING claim per course competency at the target level, explaining where it comes from', () => {
    const claims = teachingClaims([course([5, 4, 5], [['radar', 3], ['nowcast', 2]])]);
    expect(claims).toEqual([
      { competencyId: 'radar', level: 3, evidenceType: 'TEACHING', verified: false, note: 'Teaching record: taught “DWR Basics”, rated 4.7/5 by 3 trainees' },
      expect.objectContaining({ competencyId: 'nowcast', level: 2, evidenceType: 'TEACHING' }),
    ]);
  });

  it('adds nothing for courses below the thresholds (and never penalises)', () => {
    expect(teachingClaims([course([2, 1, 1, 2], [['radar', 3]]), course([5, 5], [['radar', 3]])])).toEqual([]);
  });

  it('keeps the highest level when several good courses teach the same competency', () => {
    const claims = teachingClaims([course([5, 5, 5], [['radar', 2]], 'Intro'), course([4, 4, 5], [['radar', 3]], 'Advanced')]);
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ level: 3 });
    expect(claims[0]!.note).toMatch(/Advanced/);
  });
});

describe('effect on the fit score (the CLAUDE.md formula is unchanged)', () => {
  const req: Requirement[] = [{ competencyId: 'radar', competencyName: 'Radar Meteorology', minLevel: 3, weight: 1 }];

  it('upgrades a self-declared claim (0.5) to teaching trust (0.8)', () => {
    const own = { competencyId: 'radar', level: 3, evidenceType: 'SELF_DECLARED' as const, verified: false };
    const before = computeTrainerFit(req, [own]);
    const after = computeTrainerFit(req, [own, ...teachingClaims([course([5, 4, 5], [['radar', 3]])])]);
    expect(before.fitPercent).toBe(50);
    expect(after.fitPercent).toBe(80);
    expect(after.breakdown[0]!.evidenceNote).toMatch(/Teaching record/);
  });

  it('does not replace stronger evidence (a verified certificate stays)', () => {
    const own = { competencyId: 'radar', level: 3, evidenceType: 'CERTIFICATE' as const, verified: true, note: 'WMO course' };
    const fit = computeTrainerFit(req, [own, ...teachingClaims([course([5, 5, 5], [['radar', 3]])])]);
    expect(fit.fitPercent).toBe(100);
    expect(fit.breakdown[0]).toMatchObject({ evidenceType: 'CERTIFICATE', evidenceNote: 'WMO course' });
  });

  it('turns a missing competency into a covered one (no longer a partial fit)', () => {
    const fit = computeTrainerFit(req, teachingClaims([course([4, 4, 4], [['radar', 3]])]));
    expect(fit).toMatchObject({ fitPercent: 80, partialFit: false });
  });
});
