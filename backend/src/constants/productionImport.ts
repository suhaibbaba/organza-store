// npm run import:prod: names and numbers for the one-way live-to-sandbox catalogue copy (refusals in productionImport/guards.ts).

/** Where the command reads its two connections from. Server-side env only. */
export const PRODUCTION_IMPORT_ENV = {
  /** The live shop's database, read and never written — ideally a read-only role, so one-way holds at the database too. */
  databaseUrl: "PRODUCTION_DATABASE_URL",
  /** The live shop's UPLOAD_DIR as this machine sees it; photos are copied file by file, so it must be mounted here. */
  uploadDir: "PRODUCTION_UPLOAD_DIR",
  /** The confirmation, which has to spell out the database being wiped. */
  confirm: "STORE_IMPORT_CONFIRM",
} as const;

/** A target database must say "sandbox" in its own name — the second check, independent of APP_ENV. */
export const SANDBOX_DATABASE_MARKER = "sandbox";

/** The only APP_ENV this command will write to. */
export const IMPORT_TARGET_APP_ENV = "sandbox";

/** Makes every transaction on the production connection read-only at the server; proven on connect (source.ts). */
export const READ_ONLY_CONNECTION_OPTION = "-c default_transaction_read_only=on";

/** Flags the command understands. */
export const PRODUCTION_IMPORT_FLAGS = {
  /** Import rows without photographs, for a machine that cannot see production's uploads. */
  skipImages: "--skip-images",
} as const;

/** Rows per createMany: Postgres allows 65535 parameters and Product has ~25 columns, so plenty of headroom. */
export const IMPORT_BATCH_SIZE = 500;

/** Wipe and write are one transaction (a failure keeps the old catalogue), so the timeout fits a real catalogue. */
export const IMPORT_TRANSACTION_TIMEOUT_MS = 10 * 60 * 1000;
export const IMPORT_TRANSACTION_MAX_WAIT_MS = 30 * 1000;

/** The same ceiling for the read side, which is one consistent snapshot. */
export const SOURCE_SNAPSHOT_TIMEOUT_MS = 10 * 60 * 1000;

/** How many missing photo files the report names before it stops. */
export const MISSING_IMAGE_EXAMPLES = 5;

/** Sequences behind human-facing numbers, reset after import so the next new product cannot collide. */
export const PRODUCT_NUMBER_SEQUENCE = { table: '"Product"', column: "productNumber" } as const;
export const ORDER_NUMBER_SEQUENCE = { table: '"Order"', column: "orderNumber" } as const;
