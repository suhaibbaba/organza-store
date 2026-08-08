// Guard rails for the two commands that can destroy a shop's data.
//
// Both values have to be typed out in full. A bare "1" is something that ends
// up in a shell profile, a CI variable or somebody's history and then fires by
// accident six months later; a sentence you have to mean is not.
// (The test suite guards its own target the same way — see
// tests/constants/targets.ts.)

/** "This database is disposable" — required by `seed:demo`. */
export const DISPOSABLE_OVERRIDE_VALUE = "I-KNOW-THIS-IS-NOT-PRODUCTION";

/** "Yes, wipe it" — required by `db:reset`, every single run. */
export const DESTRUCTIVE_CONFIRM_VALUE = "I-KNOW-THIS-DELETES-EVERYTHING";

/** ...and this on top, if the target really is the live shop. */
export const PRODUCTION_OVERRIDE_VALUE = "I-KNOW-THIS-IS-PRODUCTION";

export const DANGEROUS_COMMAND_ENV = {
  demoSeed: "ORGANZA_ALLOW_DEMO_SEED",
  dbResetConfirm: "ORGANZA_DB_RESET_CONFIRM",
  productionOverride: "ORGANZA_ALLOW_PRODUCTION",
} as const;
