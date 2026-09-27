// Response shapes of /api/subjects and /api/subjects/:id/trainer-matches.

export type EvidenceType = 'CERTIFICATE' | 'QUALIFICATION' | 'EXPERIENCE' | 'TEACHING' | 'SELF_DECLARED';

export interface SubjectRequirement {
  competency: { id: string; name: string; category: 'DOMAIN' | 'FUNCTIONAL' | 'BEHAVIOURAL' };
  minLevel: number;
  weight: number;
}

export interface Subject {
  id: string;
  name: string;
  description: string;
  requirements: SubjectRequirement[];
}

export interface BreakdownRow {
  competencyId: string;
  competencyName: string;
  minLevel: number;
  weight: number;
  claimedLevel: number | null;
  evidenceType: EvidenceType | null;
  evidenceNote: string | null;
  verified: boolean;
  trust: number;
  levelRatio: number;
  coverage: number;
  contribution: number;
  status: 'MEETS' | 'BELOW_LEVEL' | 'MISSING';
}

export interface TrainerMatch {
  rank: number;
  fitScore: number;
  fitPercent: number;
  partialFit: boolean;
  missingCompetencies: string[];
  trainer: {
    id: string;
    fullName: string;
    designation: string | null;
    institute: { code: string; name: string } | null;
    trainerProfile: { headline: string | null; yearsOfExperience: number | null } | null;
  };
  breakdown: BreakdownRow[];
}

// Plain-English label for the evidence behind a claim.
export function evidenceLabel(row: Pick<BreakdownRow, 'evidenceType' | 'verified'>) {
  switch (row.evidenceType) {
    case 'CERTIFICATE':
      return row.verified ? 'Verified certificate' : 'Certificate (not yet verified)';
    case 'QUALIFICATION':
      return row.verified ? 'Verified qualification' : 'Qualification (not yet verified)';
    case 'EXPERIENCE':
      return 'Work experience';
    case 'TEACHING':
      return 'Teaching record';
    case 'SELF_DECLARED':
      return 'Self-declared';
    default:
      return 'No claim';
  }
}

export const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
