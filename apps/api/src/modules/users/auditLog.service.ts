import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

export const auditQuerySchema = z.object({
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// Read-only view of the audit log for admins: newest first, optionally one action type.
export async function listAuditLog(query: z.infer<typeof auditQuerySchema>) {
  const where = query.action ? { action: query.action } : {};
  const [items, total, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ['action'], _count: true, orderBy: { action: 'asc' } }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize, actions: actions.map((a) => ({ action: a.action, count: a._count })) };
}
