import { Injectable } from '@nestjs/common';
import { auditLog } from '../../database/schema/index.js';
import type { Transaction } from '../../database/unit-of-work.js';

export interface AuditEntry {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}

/**
 * Rule 3: the audit row is written with the transaction handle of the change it describes,
 * so the two commit or fail together. There is deliberately no default executor.
 */
@Injectable()
export class AuditService {
  async record(tx: Transaction, entry: AuditEntry): Promise<void> {
    await tx.insert(auditLog).values({
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      reason: entry.reason ?? null,
    });
  }
}
