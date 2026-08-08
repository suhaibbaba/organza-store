// `npm run init` — where the shop's staff roster comes from.
//
// Deliberately NOT a list in this file. The people who work in the shop, their
// names, their email addresses and their phone numbers are operational data,
// not source code: hiring somebody should not be a commit, and a real person's
// contact details should not sit in git history forever, on a public remote,
// after they have left. So the roster is a JSON file read at run time, and
// this file only knows how to find it.

/** The flags `init` understands. */
export const INIT_FLAGS = {
  /** Path to the roster. `npm run init -- --accounts ./staff.json` */
  accounts: "--accounts",
  /**
   * Per-account overrides for a scripted run, keyed by email — for correcting
   * one number without editing the file:
   *
   *   npm run init -- --phone someone@example.com=+970599123456 \
   *                   --name  someone@example.com="Their Name"
   */
  phone: "--phone",
  name: "--name",
} as const;

/** Overrides the default path. Lowest precedence after the flag. */
export const STAFF_FILE_ENV = "ORGANZA_STAFF_FILE";

/**
 * Where the roster lives when nothing says otherwise: `staff.json` beside the
 * repo, NOT inside `backend/`.
 *
 * Outside the project on purpose — it sits next to the deployment's `.env`
 * files, is git-ignored, and survives the deploy's `git reset --hard` because
 * git does not touch ignored files.
 */
export const DEFAULT_STAFF_FILE = "staff.json";

/** Committed alongside it, showing the shape. Named in the "file not found" message. */
export const STAFF_EXAMPLE_FILE = "staff.example.json";

/**
 * Fields a roster entry may carry. Anything else is refused rather than
 * ignored: a `"phoneNumber"` that silently does nothing is a phone number
 * nobody notices is missing until the account is created without one.
 *
 * Keys beginning with `_` are allowed through as comments, since JSON has no
 * syntax for one.
 */
export const STAFF_ENTRY_FIELDS = ["email", "role", "name", "phone"] as const;
export const STAFF_COMMENT_PREFIX = "_";
