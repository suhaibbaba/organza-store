import { afterEach, describe, expect, it } from "vitest";
import { PRODUCTION_IMPORT_ENV, READ_ONLY_CONNECTION_OPTION } from "@/constants";
import {
  assertConfirmedTarget,
  databaseNameOf,
  readOnlyConnectionUrl,
  resolveImportEndpoints,
} from "@/lib/productionImport/guards";

// The guards in front of `npm run import:prod`.
//
// This command copies the live shop's catalogue into the sandbox and WIPES
// the sandbox to do it. Run the other way round it would delete the shop's
// entire catalogue — so the refusals below are the whole safety of it, and
// they are asserted rather than assumed. Each one is proven to fire ON ITS
// OWN, with every other condition satisfied, because "one of the four would
// have caught it" is only true if each of the four actually does.

const SANDBOX_URL = "postgresql://app:pw@db-sandbox:5432/organza_sandbox?schema=public";
const PRODUCTION_URL = "postgresql://reader:pw@db-live:5432/organza?schema=public";
const SANDBOX_DATABASE = "organza_sandbox";

const APP_ENV = "APP_ENV";
const TOUCHED = [APP_ENV, "DATABASE_URL", PRODUCTION_IMPORT_ENV.databaseUrl, PRODUCTION_IMPORT_ENV.confirm];
const ORIGINAL = Object.fromEntries(TOUCHED.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of TOUCHED) {
    if (ORIGINAL[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL[key];
  }
});

/** A run that is pointed the right way round, which each test then breaks in one place. */
function setValidRun(overrides: Record<string, string | undefined> = {}): void {
  const values: Record<string, string | undefined> = {
    [APP_ENV]: "sandbox",
    DATABASE_URL: SANDBOX_URL,
    [PRODUCTION_IMPORT_ENV.databaseUrl]: PRODUCTION_URL,
    [PRODUCTION_IMPORT_ENV.confirm]: SANDBOX_DATABASE,
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("Production import — the target", () => {
  it("accepts a sandbox that says so in both APP_ENV and its database name", () => {
    setValidRun();
    const endpoints = resolveImportEndpoints();
    expect(endpoints.targetDatabase).toBe(SANDBOX_DATABASE);
    expect(endpoints.target).toBe("db-sandbox:5432/organza_sandbox");
    expect(() => assertConfirmedTarget(endpoints)).not.toThrow();
  });

  it("refuses when APP_ENV is unset — unset means production", () => {
    setValidRun({ [APP_ENV]: undefined });
    expect(() => resolveImportEndpoints()).toThrow(/REFUSING TO RUN/);
  });

  it("refuses when APP_ENV says production, with no override", () => {
    setValidRun({ [APP_ENV]: "production" });
    expect(() => resolveImportEndpoints()).toThrow(/REFUSING TO RUN/);
  });

  it('refuses a database whose name does not contain "sandbox", however APP_ENV is set', () => {
    setValidRun({ DATABASE_URL: PRODUCTION_URL, [PRODUCTION_IMPORT_ENV.confirm]: "organza" });
    expect(() => resolveImportEndpoints()).toThrow(/does not contain "sandbox"/);
  });

  it("refuses with no DATABASE_URL at all", () => {
    setValidRun({ DATABASE_URL: undefined });
    expect(() => resolveImportEndpoints()).toThrow(/DATABASE_URL is not set/);
  });
});

describe("Production import — the source", () => {
  it("refuses when there is no production connection to read", () => {
    setValidRun({ [PRODUCTION_IMPORT_ENV.databaseUrl]: undefined });
    expect(() => resolveImportEndpoints()).toThrow(new RegExp(PRODUCTION_IMPORT_ENV.databaseUrl));
  });

  it("refuses when source and target are the same database", () => {
    setValidRun({ [PRODUCTION_IMPORT_ENV.databaseUrl]: SANDBOX_URL });
    expect(() => resolveImportEndpoints()).toThrow(/same database/);
  });

  it("treats a different user on the same host and database as the same database", () => {
    setValidRun({
      [PRODUCTION_IMPORT_ENV.databaseUrl]: "postgresql://someone-else:pw@db-sandbox:5432/organza_sandbox",
    });
    expect(() => resolveImportEndpoints()).toThrow(/same database/);
  });

  it("hands back a source connection that is read-only at the server", () => {
    setValidRun();
    const { sourceUrl } = resolveImportEndpoints();
    expect(decodeURIComponent(new URL(sourceUrl).searchParams.get("options") ?? "")).toBe(
      READ_ONLY_CONNECTION_OPTION
    );
  });

  it("never names the password in what it prints", () => {
    setValidRun();
    const { source, target } = resolveImportEndpoints();
    expect(`${source} ${target}`).not.toContain("pw");
  });
});

describe("Production import — the confirmation", () => {
  it("refuses when nothing was confirmed", () => {
    setValidRun({ [PRODUCTION_IMPORT_ENV.confirm]: undefined });
    expect(() => assertConfirmedTarget(resolveImportEndpoints())).toThrow(/Name the database being wiped/);
  });

  it("refuses a confirmation that names a different database", () => {
    setValidRun({ [PRODUCTION_IMPORT_ENV.confirm]: "organza" });
    expect(() => assertConfirmedTarget(resolveImportEndpoints())).toThrow(/is not this database's name/);
  });

  it("accepts the target's own name, whitespace and all", () => {
    setValidRun({ [PRODUCTION_IMPORT_ENV.confirm]: `  ${SANDBOX_DATABASE}\n` });
    expect(() => assertConfirmedTarget(resolveImportEndpoints())).not.toThrow();
  });
});

describe("Production import — the read-only rewrite", () => {
  it("adds the read-only option and keeps the rest of the connection intact", () => {
    const url = new URL(readOnlyConnectionUrl(PRODUCTION_URL));
    expect(url.searchParams.get("schema")).toBe("public");
    expect(url.searchParams.get("options")).toBe(READ_ONLY_CONNECTION_OPTION);
    expect(url.username).toBe("reader");
  });

  it("encodes the option's spaces as %20 — libpq does not read + as a space", () => {
    expect(readOnlyConnectionUrl(PRODUCTION_URL)).toContain("%20");
    expect(readOnlyConnectionUrl(PRODUCTION_URL)).not.toContain("+");
  });

  it("keeps options the connection already carried", () => {
    const rewritten = readOnlyConnectionUrl(`${PRODUCTION_URL}&options=-c statement_timeout%3D5000`);
    const options = new URL(rewritten).searchParams.get("options") ?? "";
    expect(options).toContain("statement_timeout=5000");
    expect(options).toContain(READ_ONLY_CONNECTION_OPTION);
  });

  it("reads the database name out of a connection string", () => {
    expect(databaseNameOf(SANDBOX_URL)).toBe(SANDBOX_DATABASE);
    expect(databaseNameOf("not a url")).toBe("");
  });
});
