import type { AuditAction } from "@prisma/client";

export interface AuditEntry {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
}
