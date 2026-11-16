import { join } from 'node:path';
import postgres from 'postgres';
import { runMigrations } from '../src/database/migrate.js';
import { adminDatabaseUrl, databaseName, testDatabaseUrl } from './helpers/test-database.js';

/**
 * Creates a fresh throwaway database for the run: dropped and recreated, then migrated.
 * Never points at a database whose name does not end in `_test`.
 */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  const name = databaseName(url);
  if (!name.endsWith('_test')) throw new Error(`Refusing to reset non-test database ${name}`);
  const admin = postgres(adminDatabaseUrl(), { max: 1, onnotice: () => undefined });
  try {
    await admin.unsafe(`drop database if exists "${name.replaceAll('"', '""')}" with (force)`);
    await admin.unsafe(`create database "${name.replaceAll('"', '""')}"`);
  } finally {
    await admin.end();
  }
  await runMigrations(url, join(process.cwd(), 'drizzle'));
}
