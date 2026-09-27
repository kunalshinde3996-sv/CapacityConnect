import { prisma } from '../../lib/prisma.js';

const WEEKS = 8;
const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

// Participation rate: of the trainees who were given something to do (enrolled in at least
// one course that has a published assessment), how many submitted at least one assessment.
function participation(expected: Set<string>, participated: Set<string>) {
  const count = [...expected].filter((id) => participated.has(id)).length;
  return { participants: count, eligible: expected.size, rate: expected.size ? round1((count / expected.size) * 100) : null };
}

// Everything on the admin dashboard, in one request.
export async function getDashboard() {
  const since = new Date(Date.now() - WEEKS * 7 * DAY_MS);
  const [usersByRole, usersByStatus, coursesByStatus, enrollments, certificates, attempts, institutes, recentSubmissions, topCourses] =
    await Promise.all([
      prisma.user.groupBy({ by: ['role'], where: { status: 'APPROVED' }, _count: true }),
      prisma.user.groupBy({ by: ['status'], _count: true }),
      prisma.course.groupBy({ by: ['status'], _count: true }),
      prisma.enrollment.findMany({
        where: { status: { not: 'DROPPED' } },
        select: { userId: true, status: true, course: { select: { assessments: { where: { published: true }, select: { id: true } } } }, user: { select: { instituteId: true } } },
      }),
      prisma.certificate.groupBy({ by: ['status'], _count: true }),
      prisma.assessmentAttempt.findMany({ select: { userId: true, submittedAt: true } }),
      prisma.institute.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
      prisma.assessmentAttempt.findMany({ where: { submittedAt: { gte: since } }, select: { submittedAt: true } }),
      prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        select: { id: true, title: true, _count: { select: { enrollments: { where: { status: { not: 'DROPPED' } } } } } },
      }),
    ]);

  const courseCertificates = await prisma.certificate.count({ where: { courseId: { not: null }, status: 'VERIFIED' } });

  // Participation, overall and per institute
  const submitted = new Set(attempts.filter((a) => a.submittedAt).map((a) => a.userId));
  const expected = new Set(enrollments.filter((e) => e.course.assessments.length > 0).map((e) => e.userId));
  const instituteOf = new Map(enrollments.map((e) => [e.userId, e.user.instituteId]));
  const byInstitute = institutes.map((inst) => ({
    institute: inst.code,
    name: inst.name,
    ...participation(new Set([...expected].filter((id) => instituteOf.get(id) === inst.id)), submitted),
  }));

  // Submissions per week, oldest first (week 1 = 8 weeks ago)
  const weekStart = (i: number) => new Date(Date.now() - (WEEKS - i) * 7 * DAY_MS);
  const weekly = Array.from({ length: WEEKS }, (_, i) => ({
    weekStarting: weekStart(i).toISOString().slice(0, 10),
    submissions: recentSubmissions.filter((a) => a.submittedAt! >= weekStart(i) && a.submittedAt! < weekStart(i + 1)).length,
  }));

  const count = <T extends { _count: number }>(rows: T[], key: keyof T, value: string) => rows.find((r) => r[key] === value)?._count ?? 0;

  return {
    users: {
      byRole: (['TRAINEE', 'TRAINER', 'ADMIN'] as const).map((role) => ({ role, count: count(usersByRole, 'role', role) })),
      pending: count(usersByStatus, 'status', 'PENDING'),
      disabled: count(usersByStatus, 'status', 'DISABLED'),
    },
    courses: {
      published: count(coursesByStatus, 'status', 'PUBLISHED'),
      draft: count(coursesByStatus, 'status', 'DRAFT'),
      archived: count(coursesByStatus, 'status', 'ARCHIVED'),
    },
    enrolments: { total: enrollments.length, completed: enrollments.filter((e) => e.status === 'COMPLETED').length },
    certifications: {
      verified: count(certificates, 'status', 'VERIFIED'),
      fromCourses: courseCertificates,
      pendingVerification: count(certificates, 'status', 'PENDING'),
    },
    attempts: { submitted: attempts.filter((a) => a.submittedAt).length, inProgress: attempts.filter((a) => !a.submittedAt).length },
    participation: { ...participation(expected, submitted), byInstitute },
    charts: {
      enrolmentsByCourse: topCourses
        .map((c) => ({ course: c.title, enrolments: c._count.enrollments }))
        .sort((a, b) => b.enrolments - a.enrolments),
      submissionsPerWeek: weekly,
    },
  };
}
