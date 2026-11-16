import { apiFetch } from "@/lib/api/client";

// "Email me a link", from the till.
//
// The POS only needs this one call: it is the screen somebody is standing at
// when they discover they cannot get in. Choosing the new password happens on
// the set-password page in the admin app, because that is where the emailed
// link points (the backend builds it from ADMIN_URL — see
// backend/src/lib/email/templates/passwordSetup.ts), and there is no reason
// for a second copy of that screen to exist.

/**
 * Always resolves for any well-formed address: the API answers a known
 * address, an unknown one and a deactivated account identically, and this
 * screen must not undo that by behaving differently. Only a genuine failure
 * (too many attempts, the API unreachable) throws.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch<{ requested: boolean }>("/api/password-setup/request", {
    method: "POST",
    body: { email },
  });
}
