import { describe, expect, it } from 'vitest';
import { type Claim, computeTrainerFit, rankTrainers, type Requirement, trustFor } from './matching.js';

// A realistic subject: "Doppler Weather Radar Operations"
const radarOps: Requirement[] = [
  { competencyId: 'radar', competencyName: 'Radar Meteorology', minLevel: 3, weight: 0.5 },
  { competencyId: 'nowcast', competencyName: 'Nowcasting', minLevel: 2, weight: 0.3 },
  { competencyId: 'writing', competencyName: 'Scientific Writing', minLevel: 2, weight: 0.2 },
];

const verifiedCert = (competencyId: string, level: number): Claim => ({
  competencyId,
  level,
  evidenceType: 'CERTIFICATE',
  verified: true,
});

describe('trustFor', () => {
  it.each([
    ['CERTIFICATE', true, 1.0],
    ['QUALIFICATION', true, 1.0],
    ['CERTIFICATE', false, 0.5], // unverified document = no better than self-declared
    ['QUALIFICATION', false, 0.5],
    ['EXPERIENCE', false, 0.8],
    ['TEACHING', true, 0.8],
    ['SELF_DECLARED', false, 0.5],
    ['SELF_DECLARED', true, 0.5], // "verified" does not upgrade a self-declared claim
  ] as const)('%s (verified=%s) -> %s', (evidenceType, verified, expected) => {
    expect(trustFor({ evidenceType, verified })).toBe(expected);
  });
});

describe('computeTrainerFit', () => {
  it('full fit: every requirement met with verified evidence scores 100%', () => {
    const result = computeTrainerFit(radarOps, [
      verifiedCert('radar', 3),
      verifiedCert('nowcast', 2),
      verifiedCert('writing', 2),
    ]);

    expect(result.fitScore).toBeCloseTo(1);
    expect(result.fitPercent).toBe(100);
    expect(result.partialFit).toBe(false);
    expect(result.missingCompetencies).toEqual([]);
    expect(result.breakdown.every((row) => row.status === 'MEETS')).toBe(true);
  });

  it('partial fit: a missing competency scores 0 for that row and sets partialFit', () => {
    const result = computeTrainerFit(radarOps, [verifiedCert('radar', 3), verifiedCert('nowcast', 2)]);

    expect(result.partialFit).toBe(true);
    expect(result.missingCompetencies).toEqual(['Scientific Writing']);
    expect(result.fitPercent).toBe(80); // 0.5 + 0.3, the 0.2 writing weight is lost

    const writing = result.breakdown.find((row) => row.competencyId === 'writing')!;
    expect(writing).toMatchObject({ status: 'MISSING', claimedLevel: null, trust: 0, coverage: 0, contribution: 0 });
  });

  it('a low-trust claim still avoids partial fit (partial = no claim at all)', () => {
    const result = computeTrainerFit(radarOps, [
      verifiedCert('radar', 3),
      verifiedCert('nowcast', 2),
      { competencyId: 'writing', level: 1, evidenceType: 'SELF_DECLARED', verified: false },
    ]);
    expect(result.partialFit).toBe(false);
  });

  it('self-declared vs verified: same level, verified scores double', () => {
    const single: Requirement[] = [{ competencyId: 'radar', competencyName: 'Radar Meteorology', minLevel: 3, weight: 1 }];

    const verified = computeTrainerFit(single, [verifiedCert('radar', 3)]);
    const experience = computeTrainerFit(single, [{ competencyId: 'radar', level: 3, evidenceType: 'EXPERIENCE', verified: false }]);
    const selfDeclared = computeTrainerFit(single, [{ competencyId: 'radar', level: 3, evidenceType: 'SELF_DECLARED', verified: false }]);

    expect(verified.fitPercent).toBe(100);
    expect(experience.fitPercent).toBe(80);
    expect(selfDeclared.fitPercent).toBe(50);
  });

  it('a claimed Expert level (4) above the required 3 is capped at full coverage', () => {
    const exact = computeTrainerFit(radarOps, [verifiedCert('radar', 3)]);
    const above = computeTrainerFit(radarOps, [verifiedCert('radar', 4)]);

    const row = above.breakdown.find((r) => r.competencyId === 'radar')!;
    expect(row.levelRatio).toBe(1); // 4/3 would be 1.33, capped at 1
    expect(row.contribution).toBeCloseTo(0.5);
    expect(above.fitScore).toBeCloseTo(exact.fitScore);
  });

  it('a level below the requirement gives proportional coverage', () => {
    const result = computeTrainerFit(radarOps, [verifiedCert('radar', 2)]);
    const row = result.breakdown.find((r) => r.competencyId === 'radar')!;

    expect(row.status).toBe('BELOW_LEVEL');
    expect(row.levelRatio).toBeCloseTo(2 / 3);
    expect(row.contribution).toBeCloseTo(0.5 * (2 / 3));
  });

  it('weights: the same claim is worth more on a heavily weighted competency', () => {
    // Trainer A only covers Radar (weight 0.5); trainer B only covers Writing (weight 0.2).
    const a = computeTrainerFit(radarOps, [verifiedCert('radar', 3)]);
    const b = computeTrainerFit(radarOps, [verifiedCert('writing', 2)]);

    expect(a.fitPercent).toBe(50);
    expect(b.fitPercent).toBe(20);
  });

  it('combines weight, level and trust in one score (worked example)', () => {
    // radar:   level 4 vs 3 -> ratio 1,   EXPERIENCE 0.8     -> 0.5 x 0.8       = 0.40
    // nowcast: level 1 vs 2 -> ratio 0.5, verified cert 1.0  -> 0.3 x 0.5       = 0.15
    // writing: level 2 vs 2 -> ratio 1,   SELF_DECLARED 0.5  -> 0.2 x 0.5       = 0.10
    //                                                            fitScore     = 0.65
    const result = computeTrainerFit(radarOps, [
      { competencyId: 'radar', level: 4, evidenceType: 'EXPERIENCE', verified: false },
      verifiedCert('nowcast', 1),
      { competencyId: 'writing', level: 2, evidenceType: 'SELF_DECLARED', verified: false },
    ]);

    expect(result.breakdown.map((r) => r.contribution)).toEqual([
      expect.closeTo(0.4),
      expect.closeTo(0.15),
      expect.closeTo(0.1),
    ]);
    expect(result.fitPercent).toBe(65);
    expect(result.partialFit).toBe(false);
  });

  it('trainer with no claims scores 0% and is a partial fit on everything', () => {
    const result = computeTrainerFit(radarOps, []);

    expect(result.fitScore).toBe(0);
    expect(result.fitPercent).toBe(0);
    expect(result.partialFit).toBe(true);
    expect(result.missingCompetencies).toEqual(['Radar Meteorology', 'Nowcasting', 'Scientific Writing']);
  });

  it('ignores claims for competencies the subject does not require', () => {
    const result = computeTrainerFit(radarOps, [verifiedCert('network-security', 4)]);
    expect(result.fitPercent).toBe(0);
  });

  it('uses the best claim if a competency is claimed twice', () => {
    const result = computeTrainerFit(radarOps, [
      { competencyId: 'radar', level: 3, evidenceType: 'SELF_DECLARED', verified: false },
      verifiedCert('radar', 3),
    ]);
    expect(result.breakdown[0]).toMatchObject({ evidenceType: 'CERTIFICATE', trust: 1 });
  });

  it('rounds the percentage to one decimal place', () => {
    // 1 x (2/3) x 1 = 0.6666... -> 66.7%
    const single: Requirement[] = [{ competencyId: 'radar', competencyName: 'Radar Meteorology', minLevel: 3, weight: 1 }];
    expect(computeTrainerFit(single, [verifiedCert('radar', 2)]).fitPercent).toBe(66.7);
  });
});

describe('requirement validation', () => {
  it('rejects weights that do not sum to 1', () => {
    const bad = radarOps.map((r) => ({ ...r, weight: 0.3 }));
    expect(() => computeTrainerFit(bad, [])).toThrow(/sum to 1.0 \(got 0.900\)/);
  });

  it('accepts weights that sum to 1 despite floating point (0.1 + 0.2 + 0.7)', () => {
    const reqs = radarOps.map((r, i) => ({ ...r, weight: [0.1, 0.2, 0.7][i]! }));
    expect(() => computeTrainerFit(reqs, [])).not.toThrow();
  });

  it('rejects an empty requirement list, a zero weight and an out-of-range level', () => {
    expect(() => computeTrainerFit([], [])).toThrow(/at least one/);
    expect(() =>
      computeTrainerFit([{ ...radarOps[0]!, weight: 0 }, { ...radarOps[1]!, weight: 1 }], []),
    ).toThrow(/greater than 0/);
    expect(() => computeTrainerFit([{ ...radarOps[0]!, minLevel: 5, weight: 1 }], [])).toThrow(/1 to 4/);
  });

  it('rejects the same competency required twice', () => {
    expect(() =>
      computeTrainerFit([{ ...radarOps[0]!, weight: 0.5 }, { ...radarOps[0]!, weight: 0.5 }], []),
    ).toThrow(/required twice/);
  });
});

describe('rankTrainers', () => {
  it('sorts by fit, puts full fits before partial fits on a tie, and numbers the ranks', () => {
    const ranked = rankTrainers(radarOps, [
      { trainer: 'none', claims: [] },
      // 50% but partial (missing nowcast + writing)
      { trainer: 'partial-50', claims: [verifiedCert('radar', 3)] },
      { trainer: 'best', claims: [verifiedCert('radar', 3), verifiedCert('nowcast', 2), verifiedCert('writing', 2)] },
      // 50% and complete: every competency self-declared at the right level
      {
        trainer: 'full-50',
        claims: radarOps.map((r) => ({ competencyId: r.competencyId, level: r.minLevel, evidenceType: 'SELF_DECLARED' as const, verified: false })),
      },
    ]);

    expect(ranked.map((r) => [r.rank, r.trainer, r.fitPercent, r.partialFit])).toEqual([
      [1, 'best', 100, false],
      [2, 'full-50', 50, false],
      [3, 'partial-50', 50, true],
      [4, 'none', 0, true],
    ]);
  });
});
