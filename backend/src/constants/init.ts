// Where npm run init's staff roster comes from: a git-ignored JSON file, never a list in source (real people's details).

/** The flags `init` understands. */
export const INIT_FLAGS = {
  /** Path to the roster. `npm run init -- --accounts ./staff.json` */
  accounts: "--accounts",
  /** Per-account overrides keyed by email, e.g. --phone someone@example.com=+970599123456. */
  phone: "--phone",
  name: "--name",
} as const;

/** Overrides the default path. Lowest precedence after the flag. */
export const STAFF_FILE_ENV = "STORE_STAFF_FILE";

/** Default roster path: staff.json beside the repo, git-ignored, so it survives the deploy's git reset --hard. */
export const DEFAULT_STAFF_FILE = "staff.json";

/** Committed alongside it, showing the shape. Named in the "file not found" message. */
export const STAFF_EXAMPLE_FILE = "staff.example.json";

/** Unknown roster fields are refused, not ignored; keys starting with `_` pass as comments. */
export const STAFF_ENTRY_FIELDS = ["email", "role", "name", "phone"] as const;
export const STAFF_COMMENT_PREFIX = "_";
