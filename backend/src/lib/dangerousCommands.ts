import "dotenv/config";
import {
  COMMAND_RULE,
  DANGEROUS_COMMAND_ENV,
  DESTRUCTIVE_CONFIRM_VALUE,
  DISPOSABLE_OVERRIDE_VALUE,
  PRODUCTION_OVERRIDE_VALUE,
} from "@/constants/dangerousCommands";
import { currentAppEnv, isAppEnvDeclared, isProductionAppEnv } from "@/lib/appEnv";

// Refusals for the two data-destroying commands; they throw so callers can catch, and are terminal text, not UI (rule 12).

const RULE = COMMAND_RULE;

/** Never prints the password. `postgres://user:pw@host:5432/db` -> `host:5432/db`. */
export function describeDatabase(url = process.env.DATABASE_URL): string {
  if (!url) {
    return "(DATABASE_URL is not set)";
  }
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

/** Whether this is the shop's real database — by APP_ENV, not NODE_ENV (the sandbox is a production build too). */
export function isProductionEnv(): boolean {
  return isProductionAppEnv();
}

/** The line the refusals print, honest about a value nobody actually set. */
export function describeAppEnv(): string {
  const appEnv = currentAppEnv();
  return isAppEnvDeclared() ? appEnv : `${appEnv}  (APP_ENV is unset — assumed)`;
}

/** The house shape of every refusal: banner, lines, banner (also used by productionImport/guards.ts). */
export function refuseCommand(lines: string[]): never {
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

/** Demo seed only: the database must be declared disposable AND the process not production; no override for the second. */
export function assertDisposableDatabase(options: DisposableOptions): void {
  if (isProductionEnv()) {
    refuseCommand([
      `  ⛔  REFUSING TO RUN — ${options.command}`,
      RULE,
      `  Database : ${describeDatabase()}`,
      `  APP_ENV  : ${describeAppEnv()}`,
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
    refuseCommand([
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

/** db:reset: confirmation every run, plus a second declaration under production — refusing outright would push people to psql. */
export function assertDestructiveConfirmed(options: DestructiveOptions): void {
  if (process.env[options.confirmEnv] !== DESTRUCTIVE_CONFIRM_VALUE) {
    refuseCommand([
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
    refuseCommand([
      `  ⛔  REFUSING TO RUN — ${options.command}`,
      RULE,
      `  Database : ${describeDatabase()}`,
      `  APP_ENV  : ${describeAppEnv()}`,
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
