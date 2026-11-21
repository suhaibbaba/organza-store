import fs from "node:fs";
import path from "node:path";
import { ROLES } from "@store/shared/constants/roles";
import { isValidE164, phoneIdentityKey } from "@store/shared/lib/phone";
import {
  DEFAULT_STAFF_FILE,
  INIT_FLAGS,
  STAFF_COMMENT_PREFIX,
  STAFF_ENTRY_FIELDS,
  STAFF_EXAMPLE_FILE,
  STAFF_FILE_ENV,
} from "@/constants/init";
import type { InitAccountDetails, StaffFileProblem, StaffOverrides } from "@/types/init";
import type { Role } from "@store/shared/types/role";

// Reads and checks the staff roster, collecting every problem before the database is touched.

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

/** A findable label: position first, then the email if readable. */
function labelFor(entry: unknown, index: number): string {
  const email = isPlainObject(entry) ? entry.email : undefined;
  const readable = typeof email === "string" && email.trim() ? email.trim() : null;
  return readable ? `entry #${index + 1} (${readable})` : `entry #${index + 1}`;
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// A loose sanity check (missing @, stray space), not an RFC 5322 parser.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parsed JSON to accounts, or throws with every problem; `source` only labels the message. */
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
  // Emails compare case-insensitively and +970/+972 are one line (rule 18).
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
      if (key.startsWith(STAFF_COMMENT_PREFIX)) {
        continue;
      }
      if (!(STAFF_ENTRY_FIELDS as readonly string[]).includes(key)) {
        add(`unknown field — only ${STAFF_ENTRY_FIELDS.join(", ")} are accepted`, key);
      }
    }

    const email = requiredString(entry.email);
    const name = requiredString(entry.name);
    const phone = requiredString(entry.phone);
    const role = requiredString(entry.role);

    if (!email) {
      add("missing", "email");
    } else if (!EMAIL_SHAPE.test(email)) {
      add(`not an email address: ${JSON.stringify(email)}`, "email");
    }

    if (!name) {
      add("missing", "name");
    }

    if (!role) {
      add(`missing — one of ${ROLES.join(", ")}`, "role");
    } else if (!(ROLES as readonly string[]).includes(role)) {
      add(`unknown role ${JSON.stringify(role)} — one of ${ROLES.join(", ")}`, "role");
    }

    if (!phone) {
      add("missing — an international number such as +970599123456", "phone");
    } else if (!isValidE164(phone)) {
      // Stored exactly as entered, prefix never rewritten (rule 18).
      add(`not a valid international number: ${JSON.stringify(phone)} (E.164, e.g. +970599123456)`, "phone");
    }

    if (email && EMAIL_SHAPE.test(email)) {
      const key = email.toLowerCase();
      const first = emailSeen.get(key);
      if (first) {
        add(`already used by ${first}`, "email");
      } else {
        emailSeen.set(key, label);
      }
    }

    if (phone && isValidE164(phone)) {
      const key = phoneIdentityKey(phone);
      const first = phoneSeen.get(key);
      if (first) {
        // Different spelling, same line: said out loud so the clash doesn't look false.
        const viaPrefix = first.phone !== phone ? " — the same line written under the other prefix (+970/+972)" : "";
        add(`already used by ${first.label}${viaPrefix}`, "phone");
      } else {
        phoneSeen.set(key, { label, phone });
      }
    }

    if (email && name && phone && role && (ROLES as readonly string[]).includes(role) && isValidE164(phone)) {
      accounts.push({ email, name, phone, role: role as Role });
    }
  });

  if (problems.length > 0) {
    throw new StaffFileError(source, problems);
  }
  return accounts;
}

/** --name/--phone overrides by email; an unknown email is an error, so a typo never silently drops a correction. */
export function applyStaffOverrides(
  accounts: InitAccountDetails[],
  overrides: StaffOverrides,
  source: string,
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

  // Overrides face the same checks as file values.
  const phoneSeen = new Map<string, string>();
  for (const account of updated) {
    if (!account.name) {
      problems.push({ entry: account.email, field: "name", message: `${INIT_FLAGS.name} is empty` });
    }
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
    if (first) {
      problems.push({ entry: account.email, field: "phone", message: `already used by ${first}` });
    } else {
      phoneSeen.set(key, account.email);
    }
  }

  if (problems.length > 0) {
    throw new StaffFileError(source, problems);
  }
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
