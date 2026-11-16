import { resetEnvCache } from '../src/config/env.js';
import { testDatabaseUrl } from './helpers/test-database.js';

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = testDatabaseUrl();
process.env['JWT_SECRET'] ??= 'test-secret-test-secret-test-secret-123456';
process.env['UPLOAD_DIR'] ??= `${process.cwd()}/.test-uploads`;
resetEnvCache();
