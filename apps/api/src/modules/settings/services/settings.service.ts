import { Injectable } from '@nestjs/common';
import {
  type ShopSettings,
  shopSettingsSchema,
  type updateShopSettingsSchema,
} from '@organza/shared';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../../common/decorators/auth.decorators.js';
import { AuditService } from '../../../common/services/audit.service.js';
import { InjectDb } from '../../../database/database.module.js';
import { settings } from '../../../database/schema/index.js';
import { type Database, type Executor, inTransaction } from '../../../database/unit-of-work.js';

const SHOP = 'shop';

@Injectable()
export class SettingsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  /** The full settings document with defaults filled in. */
  async get(executor: Executor = this.db): Promise<ShopSettings> {
    const [row] = await executor.select().from(settings).where(eq(settings.id, SHOP));
    return shopSettingsSchema.parse(row?.data ?? {});
  }

  async update(
    actor: Actor,
    input: z.output<typeof updateShopSettingsSchema>,
  ): Promise<ShopSettings> {
    return inTransaction(this.db, async (tx) => {
      const [row] = await tx.select().from(settings).where(eq(settings.id, SHOP)).for('update');
      const before = shopSettingsSchema.parse(row?.data ?? {});
      const after = shopSettingsSchema.parse({ ...before, ...input });
      await tx
        .insert(settings)
        .values({ id: SHOP, data: after, updatedBy: actor.id })
        .onConflictDoUpdate({
          target: settings.id,
          set: { data: after, updatedAt: new Date(), updatedBy: actor.id },
        });
      await this.audit.record(tx, {
        userId: actor.id,
        action: 'UPDATE',
        entity: 'settings',
        entityId: SHOP,
        oldValue: before,
        newValue: after,
      });
      return after;
    });
  }
}
