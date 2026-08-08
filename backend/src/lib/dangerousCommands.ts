import "dotenv/config";
import {
  DANGEROUS_COMMAND_ENV,
  DESTRUCTIVE_CONFIRM_VALUE,
  DISPOSABLE_OVERRIDE_VALUE,
  PRODUCTION_OVERRIDE_VALUE,
} from "@/constants/dangerousCommands";

// The refusals in front of the two commands that can destroy a shop's data.
//
// They throw rather than exit(1) so a caller can catch them, and every message
// is a console message for a developer at a terminal — not user-facing UI, so
// CLAUDE.md rule 12 (no hard-coded strings) does not reach here. Nothing in
// this file is ever rendered to a member of staff.

const RULE = "═".repeat(74);

/** Never prints the password. `postgres://user:pw@host:5432/db` -> `host:5432/db`. */
export function describeDatabase(url = process.env.DATABASE_URL): string {
  if (!url) return "(DATABASE_URL is not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

export function isProductionEnv(): boolean {
  return (process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";
}

function refuse(lines: string[]): never {
  throw new Error(["", RULE, ...lines, RULE, ""].join("\n"));
}

interface DisposableOptions {
  /** npm script name, for the message. */
  command: string;
  /** Which env var says "this database is disposable". */
  overrideEnv: string;
  /** What the command is about to do, in plain words. */
  what: string;
}

/**
 * For commands that must NEVER touch a real shop: the demo seed.
 *
 * Two conditions, both required — the caller has to declare the database
 * disposable, AND the process must not be running as production. There is no
 * override for the second: demo products on the live shop is not a thing
 * anybody needs to be able to do in a hurry.
 */
export function assertDisposableDatabase(options: DisposableOptions): void {
  if (isProductionEnv()) {
    refuse([
      `  ⛔  REFUSING TO RUN — ${options.command}`,
      RULE,
      `  Database : ${describeDatabase()}`,
      "  NODE_ENV : production",
      "",
      `  This command would ${options.what}.`,
      "  There is deliberately no override for a production environment.",
      "",
      "  A real shop is set up with:",
      "      npm run bootstrap    # settings, variant types, expense categories",
      "      npm run init         # the real staff accounts, by email",
    ]);
  }

  if (process.env[options.overrideEnv] !== DISPOSABLE_OVERRIDE_VALUE) {
    refuse([
      `  ⛔  REFUSING TO RUN — ${options.command}`,
      RULE,
      `  Database : ${describeDatabase()}`,
      "",
      `  This command would ${options.what}.`,
      "",
      "  If this database is disposable, say so in full:",
      `      ${options.overrideEnv}=${DISPOSABLE_OVERRIDE_VALUE} npm run ${options.command}`,
    ]);
  }
}

interface DestructiveOptions {
  command: string;
  confirmEnv: string;
  what: string;
}

/**
 * For `db:reset`: confirmation on every run, plus a second, separate
 * declaration when the process is running as production. The shop may
 * genuinely need to wipe and restart a botched go-live — refusing outright
 * would just get the reset done by hand with psql, which is worse.
 */
export function assertDestructiveConfirmed(options: DestructiveOptions): void {
  if (process.env[options.confirmEnv] !== DESTRUCTIVE_CONFIRM_VALUE) {
    refuse([
      `  ⛔  REFUSING TO RUN — ${options.command}`,
      RULE,
      `  Database : ${describeDatabase()}`,
      "",
      `  This command would ${options.what}.`,
      "  It is not reversible and there is no undo.",
      "",
      "  If that is what you want, say so in full:",
      `      ${options.confirmEnv}=${DESTRUCTIVE_CONFIRM_VALUE} npm run ${options.command}`,
    ]);
  }

  if (isProductionEnv() && process.env[DANGEROUS_COMMAND_ENV.productionOverride] !== PRODUCTION_OVERRIDE_VALUE) {
    refuse([
      `  ⛔  REFUSING TO RUN — ${options.command}`,
      RULE,
      `  Database : ${describeDatabase()}`,
      "  NODE_ENV : production",
      "",
      "  That is the LIVE SHOP. Wiping it destroys every order, every",
      "  product, every expense and the whole audit trail.",
      "",
      "  If you genuinely mean it, say THAT in full as well:",
      `      ${DANGEROUS_COMMAND_ENV.productionOverride}=${PRODUCTION_OVERRIDE_VALUE} \\`,
      `      ${options.confirmEnv}=${DESTRUCTIVE_CONFIRM_VALUE} npm run ${options.command}`,
    ]);
  }
}
