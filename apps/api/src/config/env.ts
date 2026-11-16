import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AUTH_COOKIE_SECURE: z.enum(['auto', 'always', 'never']).default('auto'),
  TRUST_PROXY: z.string().default('loopback, linklocal, uniquelocal'),
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export function env(): Env {
  cached ??= loadEnv();
  return cached;
}

/** Tests change the environment between files; this drops the cached copy. */
export function resetEnvCache(): void {
  cached = undefined;
}
