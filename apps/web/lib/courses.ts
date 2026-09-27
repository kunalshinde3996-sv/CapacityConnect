import type { Competency } from './profile';

export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  status: CourseStatus;
  startDate: string | null;
  endDate: string | null;
  capacity: number | null;
  subject: { id: string; name: string } | null;
  trainer: { id: string; fullName: string; designation: string | null; institute: { code: string } | null } | null;
  institute: { code: string; name: string } | null;
  competencies: { targetLevel: number; competency: Competency }[];
  _count: { modules: number; enrollments: number };
  myEnrollment: string | null;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  order: number;
}

export interface CourseDetail extends Omit<CourseSummary, 'myEnrollment'> {
  subjectId: string | null;
  trainerId: string | null;
  modules: CourseModule[];
  myEnrollment: { status: string; enrolledAt: string } | null;
  canManage: boolean;
}

export function seatsLeft(c: Pick<CourseSummary, 'capacity' | '_count'>) {
  return c.capacity === null ? null : Math.max(0, c.capacity - c._count.enrollments);
}

export function courseDates(c: Pick<CourseSummary, 'startDate' | 'endDate'>) {
  const f = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (c.startDate && c.endDate) return `${f(c.startDate)} – ${f(c.endDate)}`;
  if (c.startDate) return `Starts ${f(c.startDate)}`;
  return 'Self-paced';
}

export const STATUS_TONE: Record<CourseStatus, 'amber' | 'green' | 'neutral'> = {
  DRAFT: 'amber',
  PUBLISHED: 'green',
  ARCHIVED: 'neutral',
};
