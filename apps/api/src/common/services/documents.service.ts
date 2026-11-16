import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { documentCounters } from '../../database/schema/index.js';
import type { Transaction } from '../../database/unit-of-work.js';

/**
 * Gap-free per-year document numbers (`ADJ-2026-0001`). The counter row is upserted inside
 * the document's transaction, so a rolled-back document does not consume a number.
 */
@Injectable()
export class DocumentsService {
  async next(tx: Transaction, kind: string, at: Date = new Date()): Promise<string> {
    const year = at.getUTCFullYear();
    const [row] = await tx
      .insert(documentCounters)
      .values({ kind, year, last: 1 })
      .onConflictDoUpdate({
        target: [documentCounters.kind, documentCounters.year],
        set: { last: sql`${documentCounters.last} + 1` },
      })
      .returning({ last: documentCounters.last });
    return `${kind}-${year}-${String(row?.last ?? 1).padStart(4, '0')}`;
  }
}
