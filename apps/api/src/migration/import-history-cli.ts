import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import postgres from 'postgres';
import { AppModule } from '../app.module.js';
import { HistoryImporter } from './history-import.js';
import { MigrationModule } from './migration.module.js';

/**
 * Imports the old staff, customers, orders and cash sessions (after the catalogue import).
 *
 *   SOURCE_DATABASE_URL=postgres://… node dist/migration/import-history-cli.js            (rehearsal)
 *   SOURCE_DATABASE_URL=postgres://… node dist/migration/import-history-cli.js --commit   (for real)
 *
 * Point SOURCE_DATABASE_URL at a restored copy of the old database, never at the live one.
 */
async function main(): Promise<void> {
  const url = process.env['SOURCE_DATABASE_URL'];
  if (!url) throw new Error('Set SOURCE_DATABASE_URL to a copy of the old database');
  const commit = process.argv.includes('--commit');
  const source = postgres(url, { max: 2, onnotice: () => undefined });
  const app = await NestFactory.createApplicationContext(
    { module: class ImportApp {}, imports: [AppModule, MigrationModule] } as never,
    { logger: ['error', 'warn'] },
  );
  try {
    await source`set default_transaction_read_only = on`;
    const report = await app.get(HistoryImporter).run(source, { commit });
    console.log(JSON.stringify(report, null, 2));
    const failed = report.checks.filter((c) => !c.ok);
    if (failed.length) process.exitCode = 1;
    console.log(
      commit ? 'Committed.' : 'Rehearsal only: nothing was written. Run with --commit to import.',
    );
  } finally {
    await source.end();
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
