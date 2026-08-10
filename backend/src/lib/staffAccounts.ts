import fs from "node:fs";
import path from "node:path";
import { ROLES } from "@organza/shared/constants/roles";
import { isValidE164, phoneIdentityKey } from "@organza/shared/lib/phone";
import {
  DEFAULT_STAFF_FILE,
  INIT_FLAGS,
  STAFF_COMMENT_PREFIX,
  STAFF_ENTRY_FIELDS,
  STAFF_EXAMPLE_FILE,
  STAFF_FILE_ENV,
} from "@/constants/init";
import type { InitAccountDetails, StaffFileProblem, StaffOverrides } from "@/types/init";
import type { Role } from "@organza/shared/types/role";

// Reading and checking the staff roster.
//
// `init` creates real accounts for real people in one pass, so EVERY problem
// with the file is found before the database is touched — a run that creates
// two accounts and then falls over on a typo in the third leaves a half-built
// shop that `init` will subsequently refuse to finish (it only ever populates
// an empty database). So this validates the whole file, collects every
// problem, and reports them together: one pass of the eyes, one edit, one run.
//
// Messages here are console output for whoever is standing at the terminal on
// go-live day, not UI (CLAUDE.md rule 12 governs what a member of staff reads
// in the app) — same reasoning as lib/dangerousCommands.ts.

export class StaffFileError extends Error {
  readonly problems: StaffFileProblem[];

  constructor(source: string, problems: StaffFileProblem[]) {
    const lines = problems.map((p) => `  • ${p.entry}${p.field ? ` — ${p.field}` : ""}: ${p.message}`);
    super([`${problems.length} problem(s) in ${source}:`, ...lines].join("\n"));
    this.name = "StaffFileError";
    this.problems = problems;
  }
}

/** Where the roster is, in precedence order: flag, environment, default. */
export function resolveStaffFilePath(argv: string[], repoRoot: string): string {
  const flagIndex = argv.indexOf(INIT_FLAGS.accounts);
  const fromFlag = flagIndex >= 0 ? argv[flagIndex + 1] : undefined;
  const chosen = fromFlag?.trim() || process.env[STAFF_FILE_ENV]?.trim();
  return chosen ? path.resolve(chosen) : path.resolve(repoRoot, DEFAULT_STAFF_FILE);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A label a human can find the row by. Always leads with the POSITION, then
 * the email when there is a readable one: the position is what you scroll to,
 * and the email alone is ambiguous in exactly the case you most need to find —
 * two entries carrying the same address.
 */
function labelFor(entry: unknown, index: number): string {
  const email = isPlainObject(entry) ? entry.email : undefined;
  const readable = typeof email === "string" && email.trim() ? email.trim() : null;
  return readable ? `entry #${index + 1} (${readable})` : `entry #${index + 1}`;
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Deliberately loose — this is a sanity check, not an RFC 5322 parser. The
// address either receives the set-password link or it does not, and the shop
// finds that out in minutes; what this catches is a missing @ or a stray space.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Turns parsed JSON into accounts, or throws with every problem at once.
 *
 * `source` only appears in the message, so this stays pure and testable
 * without a file on disk.
 */
export function parseStaffAccounts(raw: unknown, source: string): InitAccountDetails[] {
  const problems: StaffFileProblem[] = [];

  if (!Array.isArray(raw)) {
    throw new StaffFileError(source, [
      {
        entry: "(file)",
        message: `expected a JSON array of accounts — see ${STAFF_EXAMPLE_FILE} for the shape`,
      },
    ]);
  }
  if (raw.length === 0) {
    throw new StaffFileError(source, [{ entry: "(file)", message: "no accounts in the file" }]);
  }

  const accounts: InitAccountDetails[] = [];
  // Both are collapsed before comparison: EMAIL@x and email@x are one mailbox,
  // and +970599… and +972599… are one Palestinian line (CLAUDE.md rule 18).
  const emailSeen = new Map<string, string>();
  const phoneSeen = new Map<string, { label: string; phone: string }>();

  raw.forEach((entry, index) => {
    const label = labelFor(entry, index);
    const add = (message: string, field?: string) => problems.push({ entry: label, field, message });

    if (!isPlainObject(entry)) {
      add("expected an object with email, role, name and phone");
      return;
    }

    for (const key of Object.keys(entry)) {
      if (key.startsWith(STAFF_COMMENT_PREFIX)) continue;
      if (!(STAFF_ENTRY_FIELDS as readonly string[]).includes(key)) {
        add(`unknown field — only ${STAFF_ENTRY_FIELDS.join(", ")} are accepted`, key);
      }
    }

    const email = requiredString(entry.email);
    const name = requiredString(entry.name);
    const phone = requiredString(entry.phone);
    const role = requiredString(entry.role);

    if (!email) add("missing", "email");
    else if (!EMAIL_SHAPE.test(email)) add(`not an email address: ${JSON.stringify(email)}`, "email");

    if (!name) add("missing", "name");

    if (!role) add(`missing — one of ${ROLES.join(", ")}`, "role");
    else if (!(ROLES as readonly string[]).includes(role)) {
      add(`unknown role ${JSON.stringify(role)} — one of ${ROLES.join(", ")}`, "role");
    }

    if (!phone) add("missing — an international number such as +970599123456", "phone");
    else if (!isValidE164(phone)) {
      // Stored exactly as entered, prefix never rewritten (CLAUDE.md rule 18),
      // so it has to be right in the file.
      add(`not a valid international number: ${JSON.stringify(phone)} (E.164, e.g. +970599123456)`, "phone");
    }

    if (email && EMAIL_SHAPE.test(email)) {
      const key = email.toLowerCase();
      const first = emailSeen.get(key);
      if (first) add(`already used by ${first}`, "email");
      else emailSeen.set(key, label);
    }

    if (phone && isValidE164(phone)) {
      const key = phoneIdentityKey(phone);
      const first = phoneSeen.get(key);
      if (first) {
        // Spelled differently but the same line: worth saying out loud, or the
        // clash looks like a false positive on two numbers that plainly differ.
        const viaPrefix =
          first.phone !== phone ? " — the same line written under the other prefix (+970/+972)" : "";
        add(`already used by ${first.label}${viaPrefix}`, "phone");
      } else phoneSeen.set(key, { label, phone });
    }

    if (email && name && phone && role && (ROLES as readonly string[]).includes(role) && isValidE164(phone)) {
      accounts.push({ email, name, phone, role: role as Role });
    }
  });

  if (problems.length > 0) throw new StaffFileError(source, problems);
  return accounts;
}

/**
 * Applies `--name` / `--phone` overrides, matched by email.
 *
 * An override naming an address that is not in the file is an ERROR, not a
 * no-op: a mistyped email on the command line would otherwise mean the
 * correction you thought you made silently did not happen.
 */
export function applyStaffOverrides(
  accounts: InitAccountDetails[],
  overrides: StaffOverrides,
  source: string
): InitAccountDetails[] {
  const byEmail = new Map(accounts.map((account) => [account.email.toLowerCase(), account]));
  const problems: StaffFileProblem[] = [];

  for (const [flag, values] of [
    [INIT_FLAGS.name, overrides.names],
    [INIT_FLAGS.phone, overrides.phones],
  ] as const) {
    for (const email of values?.keys() ?? []) {
      if (!byEmail.has(email)) {
        problems.push({ entry: email, message: `${flag} names an address that is not in ${source}` });
      }
    }
  }

  const updated = accounts.map((account) => {
    const key = account.email.toLowerCase();
    return {
      ...account,
      name: overrides.names?.get(key)?.trim() || account.name,
      phone: overrides.phones?.get(key)?.trim() || account.phone,
    };
  });

  // Re-checked rather than trusted: an override goes into the same database
  // column as a file value, so it faces the same rules.
  const phoneSeen = new Map<string, string>();
  for (const account of updated) {
    if (!account.name) problems.push({ entry: account.email, field: "name", message: `${INIT_FLAGS.name} is empty` });
    if (!isValidE164(account.phone)) {
      problems.push({
        entry: account.email,
        field: "phone",
        message: `not a valid international number: ${JSON.stringify(account.phone)} (E.164, e.g. +970599123456)`,
      });
      continue;
    }
    const key = phoneIdentityKey(account.phone);
    const first = phoneSeen.get(key);
    if (first) problems.push({ entry: account.email, field: "phone", message: `already used by ${first}` });
    else phoneSeen.set(key, account.email);
  }

  if (problems.length > 0) throw new StaffFileError(source, problems);
  return updated;
}

/** Reads and validates the roster. Throws StaffFileError with everything wrong with it. */
export function loadStaffAccounts(filePath: string): InitAccountDetails[] {
  let contents: string;
  try {
    contents = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new StaffFileError(filePath, [
      {
        entry: "(file)",
        message:
          "not found or unreadable. Create it on the server (it is git-ignored), " +
          `copying ${STAFF_EXAMPLE_FILE} for the shape, or point at it with ` +
          `\`${INIT_FLAGS.accounts} <path>\` or ${STAFF_FILE_ENV}`,
      },
    ]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new StaffFileError(filePath, [
      { entry: "(file)", message: `not valid JSON — ${error instanceof Error ? error.message : String(error)}` },
    ]);
  }

  return parseStaffAccounts(parsed, filePath);
}
