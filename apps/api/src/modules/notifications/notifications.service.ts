import type { NotificationType } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendMail } from './mailer.js';

export interface NewNotification {
  type: NotificationType;
  title: string;
  body: string;
  link?: string; // in-app path, e.g. /assessments/abc
  // Same key = same notification: it is created (and emailed) at most once.
  dedupeKey?: string;
  email?: boolean; // also send an email (default true)
}

const WEB_URL_HINT = 'Open Capacity Connect to see the details.';

// Creates an in-app notification for each user and emails them. Never throws: a failed
// notification must not undo the action that triggered it (an approval, an enrolment...).
export async function notify(userIds: string[], n: NewNotification) {
  if (userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, fullName: true } });
    for (const user of users) {
      const dedupeKey = n.dedupeKey ? `${n.dedupeKey}:${user.id}` : null;
      try {
        await prisma.notification.create({
          data: { userId: user.id, type: n.type, title: n.title, body: n.body, link: n.link ?? null, dedupeKey },
        });
      } catch (err) {
        // Unique dedupeKey already exists: this user was already notified.
        if ((err as { code?: string }).code === 'P2002') continue;
        throw err;
      }
      if (n.email !== false) {
        sendMail({ to: user.email, subject: `Capacity Connect: ${n.title}`, text: `Hello ${user.fullName},\n\n${n.body}\n\n${WEB_URL_HINT}` }).catch((err) =>
          console.error('Could not send email', err),
        );
      }
    }
  } catch (err) {
    console.error('Could not create notification', err);
  }
}

// ── Deadline reminders ─────────────────────────────────────
// No scheduler on the free host (it sleeps when idle), so reminders are created
//  - by a sweep every few minutes while the API is awake (server.ts), and
//  - on demand when a trainee opens their notifications.
// The dedupeKey makes both safe to run any number of times.

const DAY_MS = 24 * 60 * 60 * 1000;

export async function deadlineSweep(onlyUserId?: string) {
  const now = new Date();
  const soon = await prisma.assessment.findMany({
    where: { published: true, deadline: { gt: now, lte: new Date(now.getTime() + DAY_MS) } },
    select: {
      id: true,
      title: true,
      deadline: true,
      course: { select: { title: true, enrollments: { where: { status: 'ENROLLED', ...(onlyUserId && { userId: onlyUserId }) }, select: { userId: true } } } },
      attempts: { where: { submittedAt: { not: null } }, select: { userId: true } },
    },
  });

  for (const a of soon) {
    const done = new Set(a.attempts.map((t) => t.userId));
    const due = a.course.enrollments.map((e) => e.userId).filter((id) => !done.has(id));
    const when = a.deadline.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
    await notify(due, {
      type: 'DEADLINE_SOON',
      title: `Due within 24 hours: ${a.title}`,
      body: `"${a.title}" (${a.course.title}) closes on ${when} IST. You have not submitted it yet.`,
      link: `/assessments/${a.id}`,
      dedupeKey: `deadline:${a.id}`,
    });
  }
}

// ── Reading ────────────────────────────────────────────────

export async function listForUser(userId: string, role: string) {
  if (role === 'TRAINEE') await deadlineSweep(userId);
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items: items.map(({ dedupeKey: _key, ...n }) => n), unread };
}

export function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, id: string) {
  const { count } = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  if (count === 0 && !(await prisma.notification.count({ where: { id, userId } }))) throw AppError.notFound('Notification not found');
}

export function markAllRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
