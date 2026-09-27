import Link from 'next/link';
import { Badge } from '@/components/ui';
import { courseDates, type CourseSummary, seatsLeft, STATUS_TONE } from '@/lib/courses';

export function CourseCard({ course, href, showStatus = false }: { course: CourseSummary; href: string; showStatus?: boolean }) {
  const seats = seatsLeft(course);
  return (
    <li className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold text-slate-900">
          <Link href={href} className="hover:text-brand-700 hover:underline">
            {course.title}
          </Link>
        </h2>
        <div className="flex gap-1.5">
          {showStatus && <Badge tone={STATUS_TONE[course.status]}>{course.status.toLowerCase()}</Badge>}
          {course.myEnrollment && course.myEnrollment !== 'DROPPED' && <Badge tone="green">Enrolled</Badge>}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {[course.trainer?.fullName ?? 'Trainer to be assigned', course.subject?.name !== course.title && course.subject?.name].filter(Boolean).join(' · ')}
      </p>
      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{course.description}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {course.competencies.map((c) => (
          <li key={c.competency.id}>
            <Badge tone="brand">
              {c.competency.name} · L{c.targetLevel}
            </Badge>
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-4 text-xs text-slate-500">
        {courseDates(course)} · {course._count.modules} module{course._count.modules === 1 ? '' : 's'} · {course._count.enrollments} enrolled
        {seats !== null && ` · ${seats === 0 ? 'full' : `${seats} seats left`}`}
      </p>
    </li>
  );
}
