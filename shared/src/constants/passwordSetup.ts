// Password set / reset by email (spec.md "Auth (details)").
//
// A staff account is created with no password at all; the person who owns the
// mailbox chooses one from a single-use link. The same machinery serves a
// forgotten password, so the two differ only in what the email says.

export const PASSWORD_TOKEN_PURPOSES = ["SET", "RESET"] as const;
export type PasswordTokenPurpose = (typeof PASSWORD_TOKEN_PURPOSES)[number];

/** How long a link stays usable, per purpose. */
export const PASSWORD_TOKEN_TTL_HOURS: Record<PasswordTokenPurpose, number> = {
  // A new member of staff may not open their mail until the next shift.
  SET: 72,
  // A forgotten password is being dealt with right now.
  RESET: 2,
};

/** Bytes of entropy behind the link. 32 bytes -> 43 url-safe characters. */
export const PASSWORD_TOKEN_BYTES = 32;

/**
 * The path the emailed link points at, on whichever admin origin the
 * deployment serves. The locale segment is prepended at build time
 * (`/ar/set-password?token=…`) because every admin route is locale-prefixed.
 */
export const PASSWORD_SETUP_PATH = "set-password";
export const PASSWORD_SETUP_TOKEN_PARAM = "token";
