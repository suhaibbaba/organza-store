import { Injectable } from '@nestjs/common';
import type { Role } from '@organza/shared';
import { eq } from 'drizzle-orm';
import { InjectDb } from '../../../database/database.module.js';
import { users } from '../../../database/schema/index.js';
import type { Database } from '../../../database/unit-of-work.js';
import { SESSION_CACHE_MS } from '../constants.js';

interface State {
  id: string;
  role: Role;
  name: string;
  isActive: boolean;
  at: number;
}

/** Re-reads the user behind a token so a deactivation or role change takes effect at once. */
@Injectable()
export class SessionStateService {
  private readonly cache = new Map<string, State>();

  constructor(@InjectDb() private readonly db: Database) {}

  async get(userId: string): Promise<State | undefined> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < SESSION_CACHE_MS) return hit;
    const [row] = await this.db
      .select({ id: users.id, role: users.role, name: users.name, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId));
    if (!row) {
      this.cache.delete(userId);
      return undefined;
    }
    const state = { ...row, at: Date.now() };
    this.cache.set(userId, state);
    return state;
  }

  forget(userId: string): void {
    this.cache.delete(userId);
  }
}
