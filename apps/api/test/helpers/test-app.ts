import 'reflect-metadata';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp, createFastifyAdapter } from '../../src/bootstrap.js';
import { DATABASE } from '../../src/database/database.module.js';
import type { Database } from '../../src/database/unit-of-work.js';

export interface TestContext {
  app: NestFastifyApplication;
  db: Database;
  close: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    logger: process.env.TEST_LOG ? ['error'] : false,
  });
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, db: app.get<Database>(DATABASE), close: () => app.close() };
}
