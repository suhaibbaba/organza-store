import type { AuditAction } from "@prisma/client";
import { prisma } from "./prisma";

// Normalizes Decimal/Date/class instances into plain JSON before writing to
// the Json columns (Prisma rejects non-plain values for Json fields).
function toPlainJson(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export async function writeAudit(entry: {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValue: toPlainJson(entry.oldValue) as never,
      newValue: toPlainJson(entry.newValue) as never,
    },
  });
}
