import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { InjectDb } from '../../../database/database.module.js';
import { loginThrottles } from '../../../database/schema/index.js';
import type { Database } from '../../../database/unit-of-work.js';
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MINUTES } from '../constants.js';

@Injectable()
export class LoginThrottleService {
  constructor(@InjectDb() private readonly db: Database) {}

  async lockedUntil(key: string): Promise<Date | null> {
    const [row] = await this.db.select().from(loginThrottles).where(eq(loginThrottles.key, key));
    return row?.lockedUntil && row.lockedUntil > new Date() ? row.lockedUntil : null;
  }

  async recordFailure(key: string): Promise<void> {
    await this.db
      .insert(loginThrottles)
      .values({ key, failures: 1 })
      .onConflictDoUpdate({
        target: loginThrottles.key,
        set: {
          failures: sql`case when ${loginThrottles.firstFailureAt} < now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES}) then 1 else ${loginThrottles.failures} + 1 end`,
          firstFailureAt: sql`case when ${loginThrottles.firstFailureAt} < now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES}) then now() else ${loginThrottles.firstFailureAt} end`,
        },
      });
    await this.db
      .update(loginThrottles)
      .set({ lockedUntil: sql`now() + make_interval(mins => ${LOGIN_LOCK_MINUTES})`, failures: 0 })
      .where(
        sql`${loginThrottles.key} = ${key} and ${loginThrottles.failures} >= ${LOGIN_MAX_FAILURES}`,
      );
  }

  async clear(key: string): Promise<void> {
    await this.db.delete(loginThrottles).where(eq(loginThrottles.key, key));
  }
}
