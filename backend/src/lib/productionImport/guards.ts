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

// ============================================================================
//  The refusals in front of `npm run import:prod`.
//
//  The command copies the live shop's catalogue into the sandbox and wipes the
//  sandbox to do it. Run the other way round it would delete the shop's entire
//  catalogue, so "one way" cannot be a convention people remember — it is four
//  independent things, each of which alone is enough to stop the run:
//
//    1. APP_ENV must SAY sandbox. Unset means production (lib/appEnv.ts), so a
//       missing env file refuses rather than proceeds.
//    2. The target database's NAME must contain "sandbox". APP_ENV is a line
//       in a compose file and can be wrong; the name travels with the data.
//    3. The confirmation has to spell out that database's name, so a command
//       copied from a chat window cannot fire against a different one.
//    4. The production connection is opened READ-ONLY at the server
//       (source.ts), and its client never leaves that module.
//
//  Nothing here is user-facing text: every message is for a person at a
//  terminal over SSH, so CLAUDE.md rule 12 does not reach it.
// ============================================================================

const COMMAND = "import:prod";

/** `postgresql://u:p@host:5432/organza_sandbox?schema=public` -> `organza_sandbox`. */
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
    // Unparseable is not "different". Refuse by claiming a match rather than
    // waving through a URL nobody could read.
    return true;
  }
}

/**
 * Turns the production URL into one whose every transaction is read-only,
 * enforced by Postgres rather than by this code being careful.
 *
 * `options` is passed straight through to the server as startup parameters.
 * URLSearchParams encodes a space as `+`, which libpq does NOT read as a
 * space, so the query string is re-encoded before it goes anywhere near a
 * connection.
 */
export function readOnlyConnectionUrl(url: string): string {
  const parsed = new URL(url);
  const existing = parsed.searchParams.get("options");
  parsed.searchParams.set(
    "options",
    existing ? `${existing} ${READ_ONLY_CONNECTION_OPTION}` : READ_ONLY_CONNECTION_OPTION
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

/**
 * Decides — before a single row is read or deleted — that this run is
 * pointed the right way round. Throws a printable refusal if it is not.
 */
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
      "      CREATE ROLE organza_readonly LOGIN PASSWORD '…';",
      "      GRANT CONNECT ON DATABASE organza TO organza_readonly;",
      "      GRANT USAGE ON SCHEMA public TO organza_readonly;",
      "      GRANT SELECT ON ALL TABLES IN SCHEMA public TO organza_readonly;",
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

/**
 * The last gate: the run has to name the database it is about to empty.
 *
 * Separate from the checks above because those establish that the target is
 * *allowed*, and this one establishes that somebody looked at it. A pasted
 * command carrying yesterday's confirmation fires against nothing.
 */
export function assertConfirmedTarget(endpoints: ResolvedEndpoints): void {
  const given = process.env[PRODUCTION_IMPORT_ENV.confirm]?.trim();
  if (given === endpoints.targetDatabase) return;

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
  if (given) lines.push(`  The confirmation given ("${given}") is not this database's name.`);
  lines.push("", "  Name the database being wiped, in full:");
  lines.push(`      ${PRODUCTION_IMPORT_ENV.confirm}=${endpoints.targetDatabase} npm run ${COMMAND}`);
  refuseCommand(lines);
}
