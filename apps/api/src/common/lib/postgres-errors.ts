export const PG = {
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',
  FOREIGN_KEY_VIOLATION: '23503',
  INSUFFICIENT_PRIVILEGE: '42501',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK: '40P01',
} as const;

interface PgLike {
  code?: unknown;
  constraint_name?: unknown;
  message?: unknown;
  cause?: unknown;
}

/** Finds the postgres error inside drizzle's wrappers. */
export function pgError(
  error: unknown,
): { code: string; constraint?: string; message: string } | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as PgLike;
    if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return {
        code: candidate.code,
        ...(typeof candidate.constraint_name === 'string' && {
          constraint: candidate.constraint_name,
        }),
        message: String(candidate.message ?? ''),
      };
    }
    current = candidate.cause;
  }
  return undefined;
}

export function violatedConstraint(error: unknown, code: string): string | undefined {
  const found = pgError(error);
  return found?.code === code ? found.constraint : undefined;
}
