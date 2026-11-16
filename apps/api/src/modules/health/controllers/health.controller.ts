import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from '../../../common/decorators/auth.decorators.js';
import { InjectDb } from '../../../database/database.module.js';
import type { Database } from '../../../database/unit-of-work.js';

@Controller('health')
export class HealthController {
  constructor(@InjectDb() private readonly db: Database) {}

  @Public()
  @Get()
  async check(): Promise<{ status: 'ok'; database: 'up' | 'down' }> {
    const database = await this.db
      .execute(sql`select 1`)
      .then(() => 'up' as const)
      .catch(() => 'down' as const);
    return { status: 'ok', database };
  }
}
