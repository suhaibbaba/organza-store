import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyStaffOverrides,
  loadStaffAccounts,
  parseStaffAccounts,
  resolveStaffFilePath,
  StaffFileError,
} from "@/lib/staffAccounts";
import { DEFAULT_STAFF_FILE, INIT_FLAGS, STAFF_FILE_ENV } from "@/constants/init";
import type { InitAccountDetails } from "@/types/init";

// The staff roster `npm run init` reads.
//
// It creates real accounts for real people in one pass, so the file is checked
// in full before the database is touched. What matters here is not just that a
// bad file is refused, but that it is refused with something specific enough
// to fix without guessing — and that NOTHING is half-accepted.

const SOURCE = "staff.json";

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    email: "one@example.com",
    role: "ADMIN",
    name: "One",
    phone: "+970599000101",
    ...overrides,
  };
}

/** The problems a bad file produced, as one searchable string. */
function problemsOf(raw: unknown): string {
  try {
    parseStaffAccounts(raw, SOURCE);
  } catch (error) {
    if (error instanceof StaffFileError) return error.message;
    throw error;
  }
  throw new Error("expected the roster to be refused, but it was accepted");
}

describe("Staff roster file", () => {
  describe("a good file", () => {
    it("reads every account, keeping the phone exactly as written", () => {
      const accounts = parseStaffAccounts(
        [
          entry(),
          entry({ email: "two@example.com", role: "MANAGER", name: "Two", phone: "+972599000102" }),
          entry({ email: "three@example.com", role: "EMPLOYEE", name: "Three", phone: "+970599000103" }),
        ],
        SOURCE
      );

      expect(accounts).toEqual([
        { email: "one@example.com", role: "ADMIN", name: "One", phone: "+970599000101" },
        { email: "two@example.com", role: "MANAGER", name: "Two", phone: "+972599000102" },
        { email: "three@example.com", role: "EMPLOYEE", name: "Three", phone: "+970599000103" },
      ]);
    });

    it("trims surrounding whitespace", () => {
      const [account] = parseStaffAccounts([entry({ email: "  one@example.com  ", name: " One " })], SOURCE);
      expect(account.email).toBe("one@example.com");
      expect(account.name).toBe("One");
    });

    it("allows _-prefixed keys as comments, since JSON has no syntax for one", () => {
      expect(() => parseStaffAccounts([entry({ _comment: "the owner" })], SOURCE)).not.toThrow();
    });

    it("accepts the committed example file", () => {
      // The example is what somebody copies. If it stopped parsing, the first
      // thing they did on go-live day would fail.
      const example = path.resolve(__dirname, "..", "..", "..", "staff.example.json");
      expect(loadStaffAccounts(example)).toHaveLength(3);
    });
  });

  describe("the file itself", () => {
    it("refuses anything that is not an array", () => {
      expect(problemsOf({ email: "one@example.com" })).toMatch(/expected a JSON array/);
    });

    it("refuses an empty roster", () => {
      expect(problemsOf([])).toMatch(/no accounts/);
    });

    it("refuses an entry that is not an object", () => {
      expect(problemsOf(["one@example.com"])).toMatch(/entry #1.*expected an object/s);
    });

    it("says where to look and how to fix it when the file is missing", () => {
      try {
        loadStaffAccounts("/nonexistent/staff.json");
        throw new Error("expected a missing file to be refused");
      } catch (error) {
        expect(error).toBeInstanceOf(StaffFileError);
        expect((error as Error).message).toMatch(/staff\.example\.json/);
        expect((error as Error).message).toMatch(/--accounts/);
      }
    });

    it("names the syntax error when the file is not valid JSON", () => {
      const broken = path.join(__dirname, `broken-${Date.now()}.json`);
      fs.writeFileSync(broken, "{ not json", "utf8");
      try {
        expect(() => loadStaffAccounts(broken)).toThrow(/not valid JSON/);
      } finally {
        fs.rmSync(broken, { force: true });
      }
    });
  });

  describe("missing fields", () => {
    for (const field of ["email", "role", "name", "phone"] as const) {
      it(`refuses an entry with no ${field}`, () => {
        const incomplete = entry();
        delete incomplete[field];
        const problems = problemsOf([incomplete]);
        expect(problems).toMatch(new RegExp(`${field}: missing`));
      });
    }

    it("refuses a blank string as firmly as a missing key", () => {
      expect(problemsOf([entry({ name: "   " })])).toMatch(/name: missing/);
    });

    it("locates an entry by position when it has no readable email", () => {
      expect(problemsOf([entry(), entry({ email: "" })])).toMatch(/entry #2 —/);
    });
  });

  describe("roles", () => {
    it("refuses a role that is not one of the three", () => {
      const problems = problemsOf([entry({ role: "OWNER" })]);
      expect(problems).toMatch(/unknown role "OWNER"/);
      // ...and says which ones ARE allowed, so the fix needs no documentation.
      expect(problems).toMatch(/ADMIN, MANAGER, EMPLOYEE/);
    });

    it("is case-sensitive — `admin` is not `ADMIN`", () => {
      expect(problemsOf([entry({ role: "admin" })])).toMatch(/unknown role "admin"/);
    });
  });

  describe("emails", () => {
    it("refuses something that is not an address", () => {
      expect(problemsOf([entry({ email: "not-an-email" })])).toMatch(/not an email address/);
    });

    it("refuses a duplicate, naming the entry it clashes with", () => {
      const problems = problemsOf([entry(), entry({ email: "one@example.com", phone: "+970599000102" })]);
      expect(problems).toMatch(/email: already used by entry #1/);
    });

    it("treats a differently-cased address as the same mailbox", () => {
      const problems = problemsOf([entry(), entry({ email: "ONE@EXAMPLE.COM", phone: "+970599000102" })]);
      expect(problems).toMatch(/already used by/);
    });
  });

  describe("phone numbers", () => {
    it("refuses a number that is not E.164", () => {
      expect(problemsOf([entry({ phone: "0599123456" })])).toMatch(/not a valid international number/);
    });

    it("refuses a duplicate", () => {
      const problems = problemsOf([entry(), entry({ email: "two@example.com" })]);
      expect(problems).toMatch(/phone: already used by entry #1/);
    });

    it("treats the same Palestinian line under +970 and +972 as one number", () => {
      // CLAUDE.md rule 18: the prefix is never rewritten, so uniqueness is
      // enforced by checking BOTH spellings. Two staff sharing a line would
      // otherwise only fail at the database's unique index, halfway through.
      const problems = problemsOf([
        entry({ phone: "+970599000101" }),
        entry({ email: "two@example.com", phone: "+972599000101" }),
      ]);
      expect(problems).toMatch(/phone: already used by entry #1/);
      expect(problems).toMatch(/the same line written under the other prefix/);
    });

    it("leaves genuinely different numbers alone", () => {
      expect(() =>
        parseStaffAccounts(
          [entry({ phone: "+970599000101" }), entry({ email: "two@example.com", phone: "+972599000999" })],
          SOURCE
        )
      ).not.toThrow();
    });
  });

  describe("unknown fields", () => {
    it("refuses a misspelt field rather than ignoring it", () => {
      // A "phoneNumber" that quietly does nothing is a phone number nobody
      // notices is missing until the account exists without one.
      const problems = problemsOf([{ ...entry(), phoneNumber: "+970599000102" }]);
      expect(problems).toMatch(/phoneNumber: unknown field/);
    });
  });

  describe("reporting", () => {
    it("reports EVERY problem at once, not just the first", () => {
      const problems = problemsOf([entry({ role: "OWNER" }), entry({ email: "two@example.com", phone: "nope" })]);
      expect(problems).toMatch(/unknown role/);
      expect(problems).toMatch(/not a valid international number/);
      expect(problems).toMatch(/^2 problem\(s\) in staff\.json:/m);
    });

    it("names the offending entry on every line", () => {
      const problems = problemsOf([entry({ role: "OWNER" }), entry({ email: "two@example.com", phone: "nope" })]);
      expect(problems).toMatch(/entry #1 \(one@example\.com\) — role:/);
      expect(problems).toMatch(/entry #2 \(two@example\.com\) — phone:/);
    });

    it("accepts nothing at all when any entry is bad", () => {
      // The whole point of validating up front: `init` creates accounts in one
      // pass and refuses a database that already has users, so a run that
      // created two of four would leave a shop nothing could finish building.
      let thrown: unknown;
      try {
        parseStaffAccounts([entry(), entry({ email: "two@example.com", role: "OWNER", phone: "+970599000102" })], SOURCE);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(StaffFileError);
      expect((thrown as StaffFileError).problems).toHaveLength(1);
    });
  });

  describe("--name / --phone overrides", () => {
    const accounts: InitAccountDetails[] = [
      { email: "one@example.com", role: "ADMIN", name: "One", phone: "+970599000101" },
      { email: "two@example.com", role: "MANAGER", name: "Two", phone: "+970599000102" },
    ];

    it("replaces a name and a number, matched by email", () => {
      const updated = applyStaffOverrides(
        accounts,
        {
          names: new Map([["one@example.com", "Corrected Name"]]),
          phones: new Map([["two@example.com", "+972599000202"]]),
        },
        SOURCE
      );
      expect(updated[0]).toMatchObject({ name: "Corrected Name", phone: "+970599000101" });
      expect(updated[1]).toMatchObject({ name: "Two", phone: "+972599000202" });
    });

    it("matches the email case-insensitively", () => {
      const updated = applyStaffOverrides(accounts, { names: new Map([["one@example.com", "X"]]) }, SOURCE);
      expect(updated[0].name).toBe("X");
    });

    it("refuses an override for an address that is not in the file", () => {
      // Silently doing nothing would mean the correction you thought you made
      // did not happen.
      expect(() =>
        applyStaffOverrides(accounts, { phones: new Map([["typo@example.com", "+970599000103"]]) }, SOURCE)
      ).toThrow(/--phone names an address that is not in staff\.json/);
    });

    it("holds an overridden number to the same rules as a file one", () => {
      expect(() =>
        applyStaffOverrides(accounts, { phones: new Map([["one@example.com", "0599123456"]]) }, SOURCE)
      ).toThrow(/not a valid international number/);
    });

    it("refuses an override that collides with another account's number", () => {
      expect(() =>
        applyStaffOverrides(accounts, { phones: new Map([["one@example.com", "+972599000102"]]) }, SOURCE)
      ).toThrow(/already used by/);
    });

    it("changes nothing when there are no overrides", () => {
      expect(applyStaffOverrides(accounts, {}, SOURCE)).toEqual(accounts);
    });
  });

  describe("where the file is", () => {
    const original = process.env[STAFF_FILE_ENV];
    afterEach(() => {
      if (original === undefined) delete process.env[STAFF_FILE_ENV];
      else process.env[STAFF_FILE_ENV] = original;
    });

    it("defaults to staff.json beside the repo, not inside backend/", () => {
      delete process.env[STAFF_FILE_ENV];
      expect(resolveStaffFilePath([], "/opt/organza")).toBe(`/opt/organza/${DEFAULT_STAFF_FILE}`);
    });

    it("takes the environment variable over the default", () => {
      process.env[STAFF_FILE_ENV] = "/srv/roster.json";
      expect(resolveStaffFilePath([], "/opt/organza")).toBe("/srv/roster.json");
    });

    it("takes the flag over everything", () => {
      process.env[STAFF_FILE_ENV] = "/srv/roster.json";
      expect(resolveStaffFilePath([INIT_FLAGS.accounts, "/tmp/other.json"], "/opt/organza")).toBe("/tmp/other.json");
    });

    it("resolves a relative path against the working directory", () => {
      delete process.env[STAFF_FILE_ENV];
      expect(resolveStaffFilePath([INIT_FLAGS.accounts, "./staff.json"], "/opt/organza")).toBe(
        path.resolve("./staff.json")
      );
    });
  });
});
