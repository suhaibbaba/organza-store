const DEFAULT_URL = 'postgres://organza:organza@localhost:5433/organza';

/** The base URL from the environment, rewritten to the throwaway `<name>_test` database. */
export function testDatabaseUrl(base = process.env['DATABASE_URL'] ?? DEFAULT_URL): string {
  const url = new URL(base);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name.endsWith('_test')) url.pathname = `/${encodeURIComponent(`${name}_test`)}`;
  return url.toString();
}

export function adminDatabaseUrl(base = process.env['DATABASE_URL'] ?? DEFAULT_URL): string {
  const url = new URL(base);
  url.pathname = '/postgres';
  return url.toString();
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}
