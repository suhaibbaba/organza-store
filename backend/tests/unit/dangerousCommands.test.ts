import { afterEach, describe, expect, it } from "vitest";
import {
  DANGEROUS_COMMAND_ENV,
  DESTRUCTIVE_CONFIRM_VALUE,
  DISPOSABLE_OVERRIDE_VALUE,
  PRODUCTION_OVERRIDE_VALUE,
} from "@/constants/dangerousCommands";
import { assertDestructiveConfirmed, assertDisposableDatabase, describeDatabase } from "@/lib/dangerousCommands";

// The refusals in front of `seed:demo` and `db:reset`. These are the guard
// rails that stop demo products, or a wipe, reaching the shop's real
// database — so they are asserted rather than assumed.

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

const TOUCHED = [
  "NODE_ENV",
  DANGEROUS_COMMAND_ENV.demoSeed,
  DANGEROUS_COMMAND_ENV.dbResetConfirm,
  DANGEROUS_COMMAND_ENV.productionOverride,
];
const ORIGINAL = Object.fromEntries(TOUCHED.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of TOUCHED) {
    if (ORIGINAL[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL[key];
  }
});

function setEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("Dangerous command guards", () => {
  describe("the demo seed", () => {
    it("refuses without the disposable-database declaration", () => {
      setEnv({ NODE_ENV: "development", [DANGEROUS_COMMAND_ENV.demoSeed]: undefined });
      expect(() => assertDisposableDatabase(DEMO_SEED)).toThrow(/REFUSING TO RUN/);
    });

    it("refuses a value that is merely truthy", () => {
      // "1" is the kind of thing that ends up in a shell profile and then
      // fires by accident six months later.
      setEnv({ NODE_ENV: "development", [DANGEROUS_COMMAND_ENV.demoSeed]: "1" });
      expect(() => assertDisposableDatabase(DEMO_SEED)).toThrow(/REFUSING TO RUN/);
    });

    it("runs once the declaration is typed out in full", () => {
      setEnv({ NODE_ENV: "development", [DANGEROUS_COMMAND_ENV.demoSeed]: DISPOSABLE_OVERRIDE_VALUE });
      expect(() => assertDisposableDatabase(DEMO_SEED)).not.toThrow();
    });

    it("refuses a production environment even WITH the declaration", () => {
      setEnv({ NODE_ENV: "production", [DANGEROUS_COMMAND_ENV.demoSeed]: DISPOSABLE_OVERRIDE_VALUE });
      // Demo products on the live shop is not something anybody needs to be
      // able to do in a hurry, so there is deliberately no override.
      expect(() => assertDisposableDatabase(DEMO_SEED)).toThrow(/no override for a production environment/);
    });

    it("points at the commands a real shop uses instead", () => {
      setEnv({ NODE_ENV: "production", [DANGEROUS_COMMAND_ENV.demoSeed]: DISPOSABLE_OVERRIDE_VALUE });
      expect(() => assertDisposableDatabase(DEMO_SEED)).toThrow(/npm run bootstrap[\s\S]*npm run init/);
    });
  });

  describe("db:reset", () => {
    it("refuses without confirmation, every run", () => {
      setEnv({ NODE_ENV: "development", [DANGEROUS_COMMAND_ENV.dbResetConfirm]: undefined });
      expect(() => assertDestructiveConfirmed(DB_RESET)).toThrow(/REFUSING TO RUN/);
    });

    it("runs on a non-production database once confirmed", () => {
      setEnv({ NODE_ENV: "development", [DANGEROUS_COMMAND_ENV.dbResetConfirm]: DESTRUCTIVE_CONFIRM_VALUE });
      expect(() => assertDestructiveConfirmed(DB_RESET)).not.toThrow();
    });

    it("needs a SECOND declaration when the environment is production", () => {
      setEnv({
        NODE_ENV: "production",
        [DANGEROUS_COMMAND_ENV.dbResetConfirm]: DESTRUCTIVE_CONFIRM_VALUE,
        [DANGEROUS_COMMAND_ENV.productionOverride]: undefined,
      });
      expect(() => assertDestructiveConfirmed(DB_RESET)).toThrow(/LIVE SHOP/);
    });

    it("runs against production only when both are typed out", () => {
      setEnv({
        NODE_ENV: "production",
        [DANGEROUS_COMMAND_ENV.dbResetConfirm]: DESTRUCTIVE_CONFIRM_VALUE,
        [DANGEROUS_COMMAND_ENV.productionOverride]: PRODUCTION_OVERRIDE_VALUE,
      });
      // The shop may genuinely need to wipe and restart a botched go-live;
      // refusing outright would just get it done by hand with psql.
      expect(() => assertDestructiveConfirmed(DB_RESET)).not.toThrow();
    });
  });

  describe("what the refusal prints", () => {
    it("names the database without ever printing its password", () => {
      const described = describeDatabase("postgresql://organza:hunter2@db.example.com:5432/organza?schema=public");
      expect(described).toBe("db.example.com:5432/organza");
      expect(described).not.toContain("hunter2");
    });

    it("says so plainly when there is no DATABASE_URL to describe", () => {
      // "" rather than undefined: an omitted argument falls back to the
      // environment, which is exactly what the real callers want.
      expect(describeDatabase("")).toContain("DATABASE_URL");
      expect(describeDatabase("not a url")).toContain("DATABASE_URL");
    });
  });
});
