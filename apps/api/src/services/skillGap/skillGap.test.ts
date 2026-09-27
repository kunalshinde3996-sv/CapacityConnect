import { describe, expect, it } from 'vitest';
import { analyseSkillGaps, type GapCompetency, teachingBar } from './skillGap.js';

const aws: GapCompetency = { id: 'aws', name: 'AWS Calibration', category: 'DOMAIN', targetLevel: 3, requiredBySubjects: [{ id: 's1', name: 'AWS Installation', minLevel: 3 }] };
const radar: GapCompetency = { id: 'radar', name: 'Radar Meteorology', category: 'DOMAIN', targetLevel: 2, requiredBySubjects: [] };

// Goa: 3 trainees; Pune: 1 trainee
const trainees = [
  { userId: 'g1', instituteId: 'goa' },
  { userId: 'g2', instituteId: 'goa' },
  { userId: 'g3', instituteId: 'goa' },
  { userId: 'p1', instituteId: 'pune' },
];

describe('teachingBar', () => {
  it('is the highest level any subject requires, or 3 when no subject requires it', () => {
    expect(teachingBar(aws)).toBe(3);
    expect(teachingBar({ requiredBySubjects: [{ id: 'a', name: 'a', minLevel: 2 }, { id: 'b', name: 'b', minLevel: 4 }] })).toBe(4);
    expect(teachingBar(radar)).toBe(3);
  });
});

describe('analyseSkillGaps', () => {
  const base = {
    competencies: [aws],
    trainees,
    traineeLevels: [
      { userId: 'g1', instituteId: 'goa', competencyId: 'aws', level: 1 },
      { userId: 'g2', instituteId: 'goa', competencyId: 'aws', level: 3 },
      // g3 has no record: "not assessed"
      { userId: 'p1', instituteId: 'pune', competencyId: 'aws', level: 2 },
    ],
    trainerEvidence: [
      { userId: 't-pune', instituteId: 'pune', competencyId: 'aws', level: 4, trust: 0.8 }, // qualified
      { userId: 't-self', instituteId: 'goa', competencyId: 'aws', level: 4, trust: 0.5 }, // self-declared: not supply
      { userId: 't-low', instituteId: 'goa', competencyId: 'aws', level: 2, trust: 1 }, // below the teaching bar
    ],
  };

  it('counts demand below target, met, not assessed, and qualified supply (all institutes)', () => {
    const [row] = analyseSkillGaps(base);
    expect(row).toMatchObject({ demand: 2, met: 1, notAssessed: 1, supplyAll: 1, supplyHere: 1, perTrainer: 2, noTrainer: false, teachingBar: 3 });
  });

  it('filters demand by institute, and separates trainers at the station from trainers anywhere', () => {
    const [row] = analyseSkillGaps({ ...base, instituteId: 'goa' });
    expect(row).toMatchObject({ demand: 1, met: 1, notAssessed: 1, supplyHere: 0, supplyAll: 1 });
  });

  it('counts a trainer once even with several qualifying claims', () => {
    const [row] = analyseSkillGaps({
      ...base,
      trainerEvidence: [...base.trainerEvidence, { userId: 't-pune', instituteId: 'pune', competencyId: 'aws', level: 3, trust: 0.8 }],
    });
    expect(row!.supplyAll).toBe(1);
  });

  it('ranks "no qualified trainer anywhere" first, then trainees waiting per trainer', () => {
    const nowcast: GapCompetency = { id: 'now', name: 'Nowcasting', category: 'DOMAIN', targetLevel: 2, requiredBySubjects: [] };
    const rows = analyseSkillGaps({
      competencies: [aws, radar, nowcast],
      trainees,
      traineeLevels: [
        // radar: 1 below target, no trainer at all -> first
        { userId: 'g1', instituteId: 'goa', competencyId: 'radar', level: 1 },
        // aws: 3 below target, 1 trainer -> 3 per trainer
        { userId: 'g1', instituteId: 'goa', competencyId: 'aws', level: 1 },
        { userId: 'g2', instituteId: 'goa', competencyId: 'aws', level: 1 },
        { userId: 'p1', instituteId: 'pune', competencyId: 'aws', level: 1 },
        // nowcast: nobody below target -> last
        { userId: 'g1', instituteId: 'goa', competencyId: 'now', level: 3 },
      ],
      trainerEvidence: [{ userId: 't1', instituteId: 'pune', competencyId: 'aws', level: 3, trust: 1 }],
    });
    expect(rows.map((r) => [r.name, r.demand, r.perTrainer, r.noTrainer])).toEqual([
      ['Radar Meteorology', 1, null, true],
      ['AWS Calibration', 3, 3, false],
      ['Nowcasting', 0, null, false],
    ]);
  });
});
