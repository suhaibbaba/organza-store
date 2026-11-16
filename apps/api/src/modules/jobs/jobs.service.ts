import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { businessDate } from '../../common/lib/dates.js';
import { env } from '../../config/env.js';
import { InjectDb } from '../../database/database.module.js';
import { jobRuns } from '../../database/schema/index.js';
import type { Database } from '../../database/unit-of-work.js';
import { SettingsService } from '../settings/services/settings.service.js';

export interface DailyJob {
  name: string;
  /** Local hour (shop time zone) after which the job runs for the day. */
  hour: number;
  run: () => Promise<unknown>;
}

const TICK_MS = 60_000;

/**
 * A tiny daily scheduler. Each minute it checks every registered job; a job runs once per shop
 * date after its hour. The (name, date) row makes it safe with more than one API instance.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Jobs');
  private readonly jobs: DailyJob[] = [];
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  register(job: DailyJob): void {
    this.jobs.push(job);
  }

  onApplicationBootstrap(): void {
    if (env().NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now: Date = new Date()): Promise<void> {
    const { timezone } = await this.settings.get();
    const date = businessDate(timezone, now);
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );
    for (const job of this.jobs) {
      if (hour < job.hour) continue;
      await this.runOnce(job, date);
    }
  }

  /** Runs the job for `date` unless some instance already did. Returns false when skipped. */
  async runOnce(job: DailyJob, date: string): Promise<boolean> {
    const claimed = await this.db
      .insert(jobRuns)
      .values({ name: job.name, runDate: date })
      .onConflictDoNothing()
      .returning();
    if (claimed.length === 0) return false;
    const where = and(eq(jobRuns.name, job.name), eq(jobRuns.runDate, date));
    try {
      const result = await job.run();
      await this.db
        .update(jobRuns)
        .set({ finishedAt: new Date(), result: (result ?? null) as object })
        .where(where);
    } catch (error) {
      this.logger.error(`${job.name} failed: ${String(error)}`);
      await this.db
        .update(jobRuns)
        .set({ finishedAt: new Date(), error: String(error) })
        .where(where);
    }
    return true;
  }

  async lastRuns() {
    return this.db.select().from(jobRuns).orderBy(jobRuns.startedAt).limit(50);
  }
}
