// `npm run import:prod` — the one-way copy of the live shop's catalogue into
// the sandbox, so the practice stack can be tested against real products.
//
// Everything here is a name or a number the command needs; the refusals that
// use them live in src/lib/productionImport/guards.ts.

/** Where the command reads its two connections from. Server-side env only. */
export const PRODUCTION_IMPORT_ENV = {
  /**
   * The LIVE shop's database, read and never written. Set on the sandbox
   * server only, ideally pointing at a role with no write privileges at all
   * (see backend/.env.example) so "one-way" is true of the database and not
   * merely of this code.
   */
  databaseUrl: "PRODUCTION_DATABASE_URL",
  /**
   * The live shop's UPLOAD_DIR, as this machine can see it. A path, not a
   * host: the photographs are copied file by file, so the directory has to be
   * mounted or synced here first.
   */
  uploadDir: "PRODUCTION_UPLOAD_DIR",
  /** The confirmation, which has to spell out the database being wiped. */
  confirm: "ORGANZA_IMPORT_CONFIRM",
} as const;

/**
 * A target database has to say what it is in its own name.
 *
 * The second of the two independent checks in front of every run: APP_ENV is
 * a value somebody types into a compose file and can therefore be wrong,
 * while the database name travels with the database itself. Both must agree
 * before anything is deleted.
 */
export const SANDBOX_DATABASE_MARKER = "sandbox";

/** The only APP_ENV this command will write to. */
export const IMPORT_TARGET_APP_ENV = "sandbox";

/**
 * Bolted onto the production connection string before Prisma opens it, so the
 * session refuses writes at the SERVER: every transaction on it starts
 * read-only, and an INSERT would be an error from Postgres rather than a bug
 * we have to have avoided. Proven on connect (see source.ts), not assumed.
 */
export const READ_ONLY_CONNECTION_OPTION = "-c default_transaction_read_only=on";

/** Flags the command understands. */
export const PRODUCTION_IMPORT_FLAGS = {
  /**
   * Import the rows without the photographs — for a run from a machine that
   * cannot see production's uploads directory. The catalogue arrives; the
   * pictures are missing until they are copied across by hand.
   */
  skipImages: "--skip-images",
} as const;

/**
 * Rows per `createMany`. Postgres binds at most 65535 parameters per
 * statement and Product is the widest table here at ~25 columns, so this
 * leaves an order of magnitude of headroom.
 */
export const IMPORT_BATCH_SIZE = 500;

/**
 * The wipe and the whole write are ONE transaction (a failure has to leave
 * the sandbox with the catalogue it already had), so the ceiling has to fit a
 * real shop's catalogue rather than Prisma's 5-second default.
 */
export const IMPORT_TRANSACTION_TIMEOUT_MS = 10 * 60 * 1000;
export const IMPORT_TRANSACTION_MAX_WAIT_MS = 30 * 1000;

/** The same ceiling for the read side, which is one consistent snapshot. */
export const SOURCE_SNAPSHOT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * How many missing photograph files the report names before it stops. Enough
 * to go and look, not so many that the summary scrolls off the terminal.
 */
export const MISSING_IMAGE_EXAMPLES = 5;

/**
 * Sequences that carry a human-facing number and therefore have to be put
 * back where the data leaves them: a product imported with productNumber 412
 * while the sequence still reads 1 makes the next product added in the
 * sandbox collide on it. Quoted exactly as the tables are named in Postgres.
 */
export const PRODUCT_NUMBER_SEQUENCE = { table: '"Product"', column: "productNumber" } as const;
export const ORDER_NUMBER_SEQUENCE = { table: '"Order"', column: "orderNumber" } as const;
