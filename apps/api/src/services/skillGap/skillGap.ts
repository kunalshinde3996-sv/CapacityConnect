// Skill-gap analysis: supply of qualified trainers vs demand from trainees, per competency.
// Pure functions (no database), with the rules agreed with the team:
//
//  DEMAND  = approved trainees (in the chosen institute) whose recorded level is BELOW the
//            competency's organisation-wide target level. Trainees with no record for the
//            competency are counted separately as "not assessed", not as demand.
//  SUPPLY  = approved trainers whose claim reaches the TEACHING BAR with trust >= 0.8
//            (verified certificate/qualification, experience, teaching, or a teaching record
//            earned from course feedback). Self-declared claims do not count.
//  TEACHING BAR = the highest minLevel any subject requires for the competency
//            (or DEFAULT_TEACHING_BAR if no subject requires it yet).
//  RANKING = competencies with demand and NO qualified trainer anywhere come first, then the
//            most trainees waiting per qualified trainer, then the largest demand.

import { TRUST } from '../matching/matching.js';

export const DEFAULT_TEACHING_BAR = 3;
export const MIN_SUPPLY_TRUST = TRUST.EXPERIENCE; // 0.8

export interface GapCompetency {
  id: string;
  name: string;
  category: string;
  targetLevel: number;
  requiredBySubjects: { id: string; name: string; minLevel: number }[];
}

export interface TraineeLevel {
  userId: string;
  instituteId: string | null;
  competencyId: string;
  level: number;
}

export interface TrainerEvidence {
  userId: string;
  instituteId: string | null;
  competencyId: string;
  level: number;
  trust: number;
}

export interface GapRow {
  competencyId: string;
  name: string;
  category: string;
  targetLevel: number;
  teachingBar: number;
  demand: number; // trainees below target
  met: number; // trainees at or above target
  notAssessed: number; // trainees with no recorded level
  supplyHere: number; // qualified trainers at the selected institute
  supplyAll: number; // qualified trainers anywhere in MoES
  perTrainer: number | null; // demand per qualified trainer (null = no trainer at all)
  noTrainer: boolean; // demand exists but nobody anywhere is qualified to teach it
  subjects: { id: string; name: string }[]; // links to trainer matching
}

export function teachingBar(c: Pick<GapCompetency, 'requiredBySubjects'>) {
  return c.requiredBySubjects.length ? Math.max(...c.requiredBySubjects.map((s) => s.minLevel)) : DEFAULT_TEACHING_BAR;
}

export function analyseSkillGaps(input: {
  competencies: GapCompetency[];
  trainees: { userId: string; instituteId: string | null }[]; // approved trainees in scope
  traineeLevels: TraineeLevel[];
  trainerEvidence: TrainerEvidence[]; // all approved trainers, every claim (incl. teaching records)
  instituteId?: string | null; // selected station, or all
}): GapRow[] {
  const inScope = (instituteId: string | null) => !input.instituteId || instituteId === input.instituteId;
  const trainees = input.trainees.filter((t) => inScope(t.instituteId));
  const traineeIds = new Set(trainees.map((t) => t.userId));

  const rows = input.competencies.map((c): GapRow => {
    const bar = teachingBar(c);
    const levels = input.traineeLevels.filter((l) => l.competencyId === c.id && traineeIds.has(l.userId));
    const demand = levels.filter((l) => l.level < c.targetLevel).length;

    // A trainer counts once per competency, using their best qualifying claim.
    const qualified = new Map<string, TrainerEvidence>();
    for (const e of input.trainerEvidence) {
      if (e.competencyId === c.id && e.level >= bar && e.trust >= MIN_SUPPLY_TRUST) qualified.set(e.userId, e);
    }
    const supplyAll = qualified.size;
    const supplyHere = input.instituteId ? [...qualified.values()].filter((e) => e.instituteId === input.instituteId).length : supplyAll;

    return {
      competencyId: c.id,
      name: c.name,
      category: c.category,
      targetLevel: c.targetLevel,
      teachingBar: bar,
      demand,
      met: levels.length - demand,
      notAssessed: trainees.length - levels.length,
      supplyHere,
      supplyAll,
      perTrainer: supplyAll ? Math.round((demand / supplyAll) * 10) / 10 : null,
      noTrainer: demand > 0 && supplyAll === 0,
      subjects: c.requiredBySubjects.map(({ id, name }) => ({ id, name })),
    };
  });

  return rows.sort(
    (a, b) =>
      Number(b.noTrainer) - Number(a.noTrainer) ||
      (b.perTrainer ?? b.demand) - (a.perTrainer ?? a.demand) ||
      b.demand - a.demand ||
      a.name.localeCompare(b.name),
  );
}
