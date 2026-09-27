// Course feedback as TEACHING evidence for trainer matching (rule agreed with the team).
//
//  - A course counts once it has at least MIN_RATINGS ratings with an average of at
//    least MIN_AVERAGE (out of 5).
//  - Each competency the course is tagged with then gets a TEACHING claim at the course's
//    target level. Trust stays the standard TEACHING value (0.8, see CLAUDE.md): feedback
//    never changes the formula, it only adds evidence.
//  - The derived claim only helps where it beats the trainer's own claim, because the
//    matching engine already uses the best claim per competency.
//  - Low ratings add nothing, but never penalise.
//  - Derived when matching runs, never stored, so it cannot go stale.

import type { Claim } from './matching.js';

export const MIN_RATINGS = 3;
export const MIN_AVERAGE = 4.0;

export interface TaughtCourse {
  title: string;
  ratings: number[]; // 1-5
  competencies: { competencyId: string; targetLevel: number }[];
}

export const averageRating = (ratings: number[]) => (ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0);

export function qualifies(ratings: number[]) {
  return ratings.length >= MIN_RATINGS && averageRating(ratings) >= MIN_AVERAGE;
}

export function teachingClaims(courses: TaughtCourse[]): Claim[] {
  const best = new Map<string, Claim>();
  for (const course of courses.filter((c) => qualifies(c.ratings))) {
    const avg = Math.round(averageRating(course.ratings) * 10) / 10;
    for (const { competencyId, targetLevel } of course.competencies) {
      const current = best.get(competencyId);
      // Several good courses on the same competency: keep the highest level.
      if (current && current.level >= targetLevel) continue;
      best.set(competencyId, {
        competencyId,
        level: targetLevel,
        evidenceType: 'TEACHING',
        verified: false,
        note: `Teaching record: taught “${course.title}”, rated ${avg}/5 by ${course.ratings.length} trainees`,
      });
    }
  }
  return [...best.values()];
}
