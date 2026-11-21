import { afterEach, describe, expect, it } from "vitest";
import {
  DANGEROUS_COMMAND_ENV,
  DESTRUCTIVE_CONFIRM_VALUE,
  DISPOSABLE_OVERRIDE_VALUE,
  PRODUCTION_OVERRIDE_VALUE,
} from "@/constants/dangerousCommands";
import {
  assertDestructiveConfirmed,
  assertDisposableDatabase,
  describeAppEnv,
  describeDatabase,
} from "@/lib/dangerousCommands";

// The guards keeping demo data and wipes off the real shop; APP_ENV decides, since the sandbox runs NODE_ENV=production too.

const DEMO_SEED = {
  command: "seed:demo",
  overrideEnv: DANGEROUS_COMMAND_ENV.demoSeed,
  what: "write demo products",
};
const DB_RESET = {
  command: "db:reset",
  confirmEnv: DANGEROUS_COMMAND_ENV.dbResetConfirm,
  what: "delete everything",
};

/** The one that separates the sandbox from the live shop. */
const APP_ENV_VAR = "APP_ENV";

const TOUCHED = [
  APP_ENV_VAR,
  DANGEROUS_COMMAND_ENV.demoSeed,
  DANGEROUS_COMMAND_ENV.dbResetConfirm,
  DANGEROUS_COMMAND_ENV.productionOverride,
];
const ORIGINAL = Object.fromEntries(TOUCHED.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of TOUCHED) {
    if (ORIGINAL[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL[key];
    }
  }
});

function setEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("Dangerous command guards", () => {
  describe("the demo seed", () => {
    it("refuses without the disposable-database declaration", () => {
      setEnv({ [APP_ENV_VAR]: "sandbox", [DANGEROUS_COMMAND_ENV.demoSeed]: undefined });
      expect(() => assertDisposableDatabase(DEMO_SEED)).toThrow(/REFUSING TO RUN/);
    });

    it("refuses a value that is merely truthy", () => {
      // "1" ends up in a shell profile and fires by accident months later.
      setEnv({ [APP_ENV_VAR]: "sandbox", [DANGEROUS_COMMAND_ENV.demoSeed]: "1" });
      expect(() => assertDisposableDatabase(DEMO_SEED)).toThrow(/REFUSING TO RUN/);
    });

    it("runs once the declaration is typed out in full", () => {
      setEnv({ [APP_ENV_VAR]: "sandbox", [DANGEROUS_COMMAND_ENV.demoSeed]: DISPOSABLE_OVERRIDE_VALUE });
      expect(() => assertDisposableDatabase(DEMO_SEED)).not.toThrow();
    });

    it("refuses a production environment even WITH the declaration", () => {
      setEnv({ [APP_ENV_VAR]: "production", [DANGEROUS_COMMAND_ENV.demoSeed]: DISPOSABLE_OVERRIDE_VALUE });
      // Demo products on the live shop has deliberately no override.
      expect(() => assertDisposableDatabase(DEMO_SEED)).toThrow(/no override for a production environment/);
    });

    it("points at the commands a real shop uses instead", () => {
      setEnv({ [APP_ENV_VAR]: "production", [DANGEROUS_COMMAND_ENV.demoSeed]: DISPOSABLE_OVERRIDE_VALUE });
      expect(() => assertDisposableDatabase(DEMO_SEED)).toThrow(/npm run bootstrap[\s\S]*npm run init/);
    });
  });

  describe("db:reset", () => {
    it("refuses without confirmation, every run", () => {
      setEnv({ [APP_ENV_VAR]: "sandbox", [DANGEROUS_COMMAND_ENV.dbResetConfirm]: undefined });
      expect(() => assertDestructiveConfirmed(DB_RESET)).toThrow(/REFUSING TO RUN/);
    });

    it("runs on a non-production database once confirmed", () => {
      setEnv({ [APP_ENV_VAR]: "sandbox", [DANGEROUS_COMMAND_ENV.dbResetConfirm]: DESTRUCTIVE_CONFIRM_VALUE });
      expect(() => assertDestructiveConfirmed(DB_RESET)).not.toThrow();
    });

    it("needs a SECOND declaration when the environment is production", () => {
      setEnv({
        [APP_ENV_VAR]: "production",
        [DANGEROUS_COMMAND_ENV.dbResetConfirm]: DESTRUCTIVE_CONFIRM_VALUE,
        [DANGEROUS_COMMAND_ENV.productionOverride]: undefined,
      });
      expect(() => assertDestructiveConfirmed(DB_RESET)).toThrow(/LIVE SHOP/);
    });

    it("runs against production only when both are typed out", () => {
      setEnv({
        [APP_ENV_VAR]: "production",
        [DANGEROUS_COMMAND_ENV.dbResetConfirm]: DESTRUCTIVE_CONFIRM_VALUE,
        [DANGEROUS_COMMAND_ENV.productionOverride]: PRODUCTION_OVERRIDE_VALUE,
      });
      // A botched go-live may need a wipe; refusing outright would just get it done by hand.
      expect(() => assertDestructiveConfirmed(DB_RESET)).not.toThrow();
    });
  });

  describe("an APP_ENV nobody set", () => {
    it("is treated as the live shop, so the wipe still asks twice", () => {
      // The safe way round: guessing "sandbox" would drop the second confirmation on the one unrebuildable database.
      setEnv({
        [APP_ENV_VAR]: undefined,
        [DANGEROUS_COMMAND_ENV.dbResetConfirm]: DESTRUCTIVE_CONFIRM_VALUE,
        [DANGEROUS_COMMAND_ENV.productionOverride]: undefined,
      });
      expect(() => assertDestructiveConfirmed(DB_RESET)).toThrow(/LIVE SHOP/);
    });

    it("says it was assumed rather than claiming somebody chose it", () => {
      setEnv({ [APP_ENV_VAR]: undefined });
      expect(describeAppEnv()).toMatch(/production.*unset/);
      setEnv({ [APP_ENV_VAR]: "sandbox" });
      expect(describeAppEnv()).toBe("sandbox");
    });

    it("falls back the same way for a value that is not one of the two", () => {
      setEnv({ [APP_ENV_VAR]: "staging" });
      expect(describeAppEnv()).toMatch(/^production/);
    });
  });

  describe("what the refusal prints", () => {
    it("names the database without ever printing its password", () => {
      const described = describeDatabase("postgresql://store:hunter2@db.example.com:5432/store?schema=public");
      expect(described).toBe("db.example.com:5432/store");
      expect(described).not.toContain("hunter2");
    });

    it("says so plainly when there is no DATABASE_URL to describe", () => {
      // "" not undefined: an omitted argument falls back to the environment, as real callers want.
      expect(describeDatabase("")).toContain("DATABASE_URL");
      expect(describeDatabase("not a url")).toContain("DATABASE_URL");
    });
  });
});
