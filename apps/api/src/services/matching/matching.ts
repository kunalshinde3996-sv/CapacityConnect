// Trainer matching: a transparent, rule-based fit score (no ML).
//
// Rules (from CLAUDE.md):
//   trust:     VERIFIED certificate/qualification = 1.0, EXPERIENCE or TEACHING = 0.8,
//              SELF_DECLARED (or an unverified certificate/qualification) = 0.5
//   coverage = min(trainerLevel / minLevel, 1) x trust        (0 if no claim)
//   fitScore = sum(weight x coverage)                          (0..1, shown as %)
//   partialFit = true if any required competency has no claim at all
//
// This file is pure: no database, no Express. That makes every rule easy to unit test,
// and the per-competency breakdown lets the UI explain every single score.

export type EvidenceType = 'CERTIFICATE' | 'QUALIFICATION' | 'EXPERIENCE' | 'TEACHING' | 'SELF_DECLARED';

export interface Requirement {
  competencyId: string;
  competencyName: string;
  minLevel: number; // 1-4
  weight: number; // weights of one subject sum to 1.0
}

export interface Claim {
  competencyId: string;
  level: number; // 1-4
  evidenceType: EvidenceType;
  verified: boolean;
  note?: string | null; // what backs the claim, shown in the breakdown
}

export type RequirementStatus =
  | 'MEETS' // claimed level >= required level
  | 'BELOW_LEVEL' // has a claim, but at a lower level than required
  | 'MISSING'; // no claim at all -> makes the trainer a "partial fit"

export interface CompetencyBreakdown {
  competencyId: string;
  competencyName: string;
  minLevel: number;
  weight: number;
  claimedLevel: number | null;
  evidenceType: EvidenceType | null;
  verified: boolean;
  trust: number; // 0, 0.5, 0.8 or 1
  levelRatio: number; // min(claimedLevel / minLevel, 1)
  coverage: number; // levelRatio x trust
  contribution: number; // weight x coverage (what this row adds to fitScore)
  status: RequirementStatus;
  evidenceNote: string | null; // note of the claim that was used
}

export interface FitResult {
  fitScore: number; // 0..1
  fitPercent: number; // 0..100, one decimal place
  partialFit: boolean;
  missingCompetencies: string[]; // names, for a quick summary
  breakdown: CompetencyBreakdown[];
}

export const TRUST = {
  VERIFIED_DOCUMENT: 1.0,
  EXPERIENCE: 0.8,
  SELF_DECLARED: 0.5,
} as const;

const WEIGHT_TOLERANCE = 1e-6;

export function trustFor(claim: Pick<Claim, 'evidenceType' | 'verified'>): number {
  switch (claim.evidenceType) {
    case 'CERTIFICATE':
    case 'QUALIFICATION':
      // A document only earns full trust once an admin has verified it.
      return claim.verified ? TRUST.VERIFIED_DOCUMENT : TRUST.SELF_DECLARED;
    case 'EXPERIENCE':
    case 'TEACHING':
      return TRUST.EXPERIENCE;
    case 'SELF_DECLARED':
      return TRUST.SELF_DECLARED;
  }
}

// Throws if the subject's requirements are not a valid scoring rubric.
export function validateRequirements(requirements: Requirement[]) {
  if (requirements.length === 0) throw new Error('A subject needs at least one requirement');

  const seen = new Set<string>();
  for (const r of requirements) {
    if (seen.has(r.competencyId)) throw new Error(`Competency ${r.competencyName} is required twice`);
    seen.add(r.competencyId);
    if (!Number.isInteger(r.minLevel) || r.minLevel < 1 || r.minLevel > 4) {
      throw new Error(`minLevel for ${r.competencyName} must be an integer from 1 to 4`);
    }
    if (!(r.weight > 0)) throw new Error(`Weight for ${r.competencyName} must be greater than 0`);
  }

  const total = requirements.reduce((sum, r) => sum + r.weight, 0);
  if (Math.abs(total - 1) > WEIGHT_TOLERANCE) {
    throw new Error(`Requirement weights must sum to 1.0 (got ${total.toFixed(3)})`);
  }
}

export function computeTrainerFit(requirements: Requirement[], claims: Claim[]): FitResult {
  validateRequirements(requirements);

  const breakdown = requirements.map((req) => {
    // The schema allows one claim per competency, but if several are passed in,
    // use whichever gives the trainer the best coverage.
    const candidates = claims.filter((c) => c.competencyId === req.competencyId).map((c) => scoreClaim(req, c));
    if (candidates.length === 0) return missingRow(req);
    return candidates.reduce((best, row) => (row.coverage > best.coverage ? row : best));
  });

  const fitScore = breakdown.reduce((sum, row) => sum + row.contribution, 0);
  const missing = breakdown.filter((row) => row.status === 'MISSING');

  return {
    fitScore,
    fitPercent: Math.round(fitScore * 1000) / 10,
    partialFit: missing.length > 0,
    missingCompetencies: missing.map((row) => row.competencyName),
    breakdown,
  };
}

export interface TrainerCandidate<T> {
  trainer: T;
  claims: Claim[];
}

export type RankedTrainer<T> = FitResult & { rank: number; trainer: T };

// Scores every trainer and sorts best first. Ties: full fits before partial fits,
// then the original order (callers pass trainers sorted by name).
export function rankTrainers<T>(requirements: Requirement[], candidates: TrainerCandidate<T>[]): RankedTrainer<T>[] {
  validateRequirements(requirements);
  return candidates
    .map((c, index) => ({ index, trainer: c.trainer, ...computeTrainerFit(requirements, c.claims) }))
    .sort(
      (a, b) =>
        b.fitPercent - a.fitPercent || Number(a.partialFit) - Number(b.partialFit) || a.index - b.index,
    )
    .map(({ index: _index, ...rest }, i) => ({ ...rest, rank: i + 1 }));
}

function scoreClaim(req: Requirement, claim: Claim): CompetencyBreakdown {
  const trust = trustFor(claim);
  const levelRatio = Math.min(claim.level / req.minLevel, 1);
  const coverage = levelRatio * trust;
  return {
    competencyId: req.competencyId,
    competencyName: req.competencyName,
    minLevel: req.minLevel,
    weight: req.weight,
    claimedLevel: claim.level,
    evidenceType: claim.evidenceType,
    verified: claim.verified,
    trust,
    levelRatio,
    coverage,
    contribution: req.weight * coverage,
    evidenceNote: claim.note ?? null,
    status: claim.level >= req.minLevel ? 'MEETS' : 'BELOW_LEVEL',
  };
}

function missingRow(req: Requirement): CompetencyBreakdown {
  return {
    competencyId: req.competencyId,
    competencyName: req.competencyName,
    minLevel: req.minLevel,
    weight: req.weight,
    claimedLevel: null,
    evidenceType: null,
    verified: false,
    trust: 0,
    levelRatio: 0,
    coverage: 0,
    contribution: 0,
    status: 'MISSING',
    evidenceNote: null,
  };
}
