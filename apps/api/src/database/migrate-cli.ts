import { runMigrations } from './migrate.js';

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is required');
runMigrations(url)
  .then(() => process.stdout.write('Migrations applied\n'))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
