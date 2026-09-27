'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type User } from './api';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type EvidenceType = 'CERTIFICATE' | 'QUALIFICATION' | 'EXPERIENCE' | 'TEACHING' | 'SELF_DECLARED';

export interface Competency {
  id: string;
  name: string;
  category: 'DOMAIN' | 'FUNCTIONAL' | 'BEHAVIOURAL';
  description?: string;
}

export interface Qualification {
  id: string;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  yearCompleted: number | null;
  status: VerificationStatus;
  rejectionReason: string | null;
  hasFile: boolean;
}

export interface Experience {
  id: string;
  organisation: string;
  title: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface Certificate {
  id: string;
  title: string;
  issuer: string;
  issuedOn: string | null;
  status: VerificationStatus;
  rejectionReason: string | null;
  hasFile: boolean;
}

export interface Claim {
  id: string;
  level: number;
  evidenceType: EvidenceType;
  evidenceNote: string | null;
  verified: boolean;
  verifiedAt: string | null;
  hasEvidenceFile: boolean;
  competency: Competency;
  certificate: { id: string; title: string; status: VerificationStatus } | null;
  qualification: { id: string; degree: string; fieldOfStudy: string; status: VerificationStatus } | null;
}

export interface Profile extends User {
  phone: string | null;
  traineeProfile: { bio: string | null; interests: string[]; employeeId: string | null } | null;
  trainerProfile: { bio: string | null; headline: string | null; yearsOfExperience: number | null } | null;
  qualifications: Qualification[];
  experiences: Experience[];
  certificates: Certificate[];
  userCompetencies: { level: number; source: string; competency: Competency }[];
  claims: Claim[];
  trainerApplications: { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewNote: string | null; createdAt: string }[];
}

// Loads the profile and the competency list; `reload` refreshes after any change.
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([api<{ profile: Profile }>('/api/me/profile'), api<{ competencies: Competency[] }>('/api/competencies')])
        .then(([p, c]) => {
          setProfile(p.profile);
          setCompetencies(c.competencies);
        })
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your profile')),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { profile, competencies, error, reload: load };
}

// Claim status in plain words, matching the trust rules used by trainer matching.
export function claimStatus(claim: Claim): { label: string; tone: 'green' | 'amber' | 'red' | 'brand' | 'neutral'; trust: number } {
  const isDocument = claim.evidenceType === 'CERTIFICATE' || claim.evidenceType === 'QUALIFICATION';
  if (isDocument && claim.verified) return { label: 'Verified by admin', tone: 'green', trust: 1 };
  if (isDocument && claim.verifiedAt) return { label: 'Not accepted by admin', tone: 'red', trust: 0.5 };
  if (isDocument) return { label: 'Waiting for admin review', tone: 'amber', trust: 0.5 };
  if (claim.evidenceType === 'SELF_DECLARED') return { label: 'Self-declared', tone: 'neutral', trust: 0.5 };
  return { label: claim.evidenceType === 'TEACHING' ? 'Teaching record' : 'Work experience', tone: 'brand', trust: 0.8 };
}

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  CERTIFICATE: 'Certificate',
  QUALIFICATION: 'Qualification (degree)',
  EXPERIENCE: 'Work experience',
  TEACHING: 'Teaching record',
  SELF_DECLARED: 'Self-declared',
};

export function errorMessage(err: unknown) {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  // Validation errors: show the first field problem, e.g. "End date cannot be before start date (endDate)"
  const [field, messages] = Object.entries(err.fieldErrors)[0] ?? [];
  return field && messages?.[0] ? `${messages[0]} (${field})` : err.message;
}
