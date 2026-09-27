import type { Prisma } from '../generated/prisma/client.js';

// Writes one AuditLog row. Takes a transaction client so the log is saved
// together with the change it describes (both succeed or both fail).
export function audit(
  tx: Prisma.TransactionClient,
  entry: { actorId: string | null; action: string; entityType: string; entityId: string; metadata?: Prisma.InputJsonValue },
) {
  return tx.auditLog.create({ data: entry });
}
