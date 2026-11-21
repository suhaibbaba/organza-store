import "dotenv/config";
import {
  COMMAND_RULE as RULE,
  IMPORT_TARGET_APP_ENV,
  PRODUCTION_IMPORT_ENV,
  READ_ONLY_CONNECTION_OPTION,
  SANDBOX_DATABASE_MARKER,
} from "@/constants";
import { currentAppEnv, isAppEnvDeclared } from "@/lib/appEnv";
import { describeDatabase, refuseCommand } from "@/lib/dangerousCommands";
import type { ImportEndpoints } from "@/types";

// The refusals in front of import:prod: four independent checks, each enough to stop a run pointed the wrong way.

const COMMAND = "import:prod";

/** `postgresql://u:p@host:5432/store_sandbox?schema=public` -> `store_sandbox`. */
export function databaseNameOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

/** Same host, same port, same database — regardless of which user is connecting. */
function isSameDatabase(a: string, b: string): boolean {
  try {
    const [left, right] = [new URL(a), new URL(b)];
    return (
      left.hostname.toLowerCase() === right.hostname.toLowerCase() &&
      (left.port || "5432") === (right.port || "5432") &&
      databaseNameOf(a).toLowerCase() === databaseNameOf(b).toLowerCase()
    );
  } catch {
    // Unparseable is not "different": refuse by treating it as a match.
    return true;
  }
}

/** Makes every transaction on the production URL read-only at the server; re-encoded since libpq reads `+` literally. */
export function readOnlyConnectionUrl(url: string): string {
  const parsed = new URL(url);
  const existing = parsed.searchParams.get("options");
  parsed.searchParams.set(
    "options",
    existing ? `${existing} ${READ_ONLY_CONNECTION_OPTION}` : READ_ONLY_CONNECTION_OPTION,
  );
  parsed.search = parsed.searchParams.toString().replace(/\+/g, "%20");
  return parsed.toString();
}

export interface ResolvedEndpoints extends ImportEndpoints {
  /** The sandbox, which is the only thing this command may write to. */
  targetUrl: string;
  /** Production, already rewritten to be read-only. */
  sourceUrl: string;
}

/** Decides — before a single row is read or deleted — that this run is pointed the right way round. */
export function resolveImportEndpoints(): ResolvedEndpoints {
  const targetUrl = process.env.DATABASE_URL ?? "";
  const rawSourceUrl = process.env[PRODUCTION_IMPORT_ENV.databaseUrl] ?? "";
  const targetDatabase = databaseNameOf(targetUrl);

  if (!targetUrl) {
    refuseCommand([
      `  ⛔  REFUSING TO RUN — ${COMMAND}`,
      RULE,
      "  DATABASE_URL is not set, so there is no target to import into.",
    ]);
  }

  // --- 1. the environment has to declare itself, and declare itself sandbox ---
  if (!isAppEnvDeclared() || currentAppEnv() !== IMPORT_TARGET_APP_ENV) {
    refuseCommand([
      `  ⛔  REFUSING TO RUN — ${COMMAND}`,
      RULE,
      `  Target   : ${describeDatabase(targetUrl)}`,
      `  APP_ENV  : ${isAppEnvDeclared() ? currentAppEnv() : "(unset — assumed production)"}`,
      "",
      "  This command DELETES the target's whole catalogue before it writes.",
      `  It runs only where APP_ENV says "${IMPORT_TARGET_APP_ENV}", and there is`,
      "  deliberately no override: the direction of this copy is not a thing",
      "  anybody should be able to reverse in a hurry.",
      "",
      "  If this really is the sandbox, its own deployment should be saying so",
      "  (docker-compose.sandbox.yml sets APP_ENV: sandbox).",
    ]);
  }

  // --- 2. ...and so does the database's own name ---
  if (!targetDatabase.toLowerCase().includes(SANDBOX_DATABASE_MARKER)) {
    refuseCommand([
      `  ⛔  REFUSING TO RUN — ${COMMAND}`,
      RULE,
      `  Target   : ${describeDatabase(targetUrl)}`,
      `  APP_ENV  : ${currentAppEnv()}`,
      "",
      `  APP_ENV says sandbox but the database is called "${targetDatabase || "(none)"}",`,
      `  which does not contain "${SANDBOX_DATABASE_MARKER}". One of the two is wrong,`,
      "  and this command will not guess which.",
      "",
      "  Both have to agree before anything is deleted — an env var can be",
      "  copied into the wrong compose file, but the name travels with the",
      "  data itself.",
    ]);
  }

  // --- 3. where production is, and that it is somewhere else ---
  if (!rawSourceUrl) {
    refuseCommand([
      `  ⛔  REFUSING TO RUN — ${COMMAND}`,
      RULE,
      `  ${PRODUCTION_IMPORT_ENV.databaseUrl} is not set, so there is nothing to import from.`,
      "",
      "  Set it on THIS server only, in the sandbox's own env file, pointing at",
      "  a read-only role on the live database:",
      "",
      "      CREATE ROLE store_readonly LOGIN PASSWORD '…';",
      "      GRANT CONNECT ON DATABASE <database> TO store_readonly;",
      "      GRANT USAGE ON SCHEMA public TO store_readonly;",
      "      GRANT SELECT ON ALL TABLES IN SCHEMA public TO store_readonly;",
      "",
      "  The connection is opened read-only either way, but a role that cannot",
      "  write is the version that survives somebody editing this file.",
    ]);
  }

  if (isSameDatabase(targetUrl, rawSourceUrl)) {
    refuseCommand([
      `  ⛔  REFUSING TO RUN — ${COMMAND}`,
      RULE,
      `  Target   : ${describeDatabase(targetUrl)}`,
      `  Source   : ${describeDatabase(rawSourceUrl)}`,
      "",
      `  Those are the same database. The wipe would delete the catalogue this`,
      "  run is about to read, which is how an import becomes a deletion.",
    ]);
  }

  return {
    targetUrl,
    sourceUrl: readOnlyConnectionUrl(rawSourceUrl),
    targetDatabase,
    target: describeDatabase(targetUrl),
    source: describeDatabase(rawSourceUrl),
  };
}

/** The last gate: the run must name the database it is about to empty, proving somebody looked. */
export function assertConfirmedTarget(endpoints: ResolvedEndpoints): void {
  const given = process.env[PRODUCTION_IMPORT_ENV.confirm]?.trim();
  if (given === endpoints.targetDatabase) {
    return;
  }

  const lines = [
    `  ⛔  REFUSING TO RUN — ${COMMAND}`,
    RULE,
    `  Target   : ${endpoints.target}`,
    `  Source   : ${endpoints.source}  (read-only)`,
    "",
    "  This command DELETES every product, category, variant, image, order,",
    "  expense, cash session, approval and audit entry in the target, then",
    "  copies production's catalogue in. Staff accounts are left alone.",
  ];
  if (given) {
    lines.push(`  The confirmation given ("${given}") is not this database's name.`);
  }
  lines.push("", "  Name the database being wiped, in full:");
  lines.push(`      ${PRODUCTION_IMPORT_ENV.confirm}=${endpoints.targetDatabase} npm run ${COMMAND}`);
  refuseCommand(lines);
}
