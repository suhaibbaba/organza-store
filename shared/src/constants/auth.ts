// Authentication facts both the backend and the two frontends have to agree
// on. The backend's own constants/auth.ts re-exports this alongside its
// server-only settings (session lifetime, sign-in rate limits).

/**
 * What Better Auth answers with when a DEACTIVATED account tries to sign in.
 *
 * Better Auth's routes do not speak our `{ success, error: { code } }`
 * envelope — it is a separate library with its own response shape — so this
 * failure travels in ITS shape, as a machine-readable `code` on a 403. The
 * login screens read it back and say "this account has been switched off"
 * rather than "wrong password" (admin/pos components/auth/login-form.tsx).
 *
 * That distinction is the whole reason it is a shared constant rather than a
 * status code checked in two places: somebody whose account was deactivated
 * this morning has a perfectly good password, and sending them round the
 * reset loop is how they end up standing at the till unable to explain what
 * is wrong. A code, not a sentence — CLAUDE.md rule 12 holds here too.
 */
export const ACCOUNT_INACTIVE_AUTH_CODE = "ACCOUNT_INACTIVE";
