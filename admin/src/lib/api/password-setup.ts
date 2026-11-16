import { apiFetch } from "@/lib/api/client";
import type { PasswordResetInvite, PasswordTokenCheck } from "@/types/auth";

// Setting a password from an emailed link. Three of these four calls need no
// session — they are what somebody with no password can reach.
//
// The token always travels in the request BODY, never in a query string:
// URLs end up in proxy logs and browser history, and this token is a working
// key to an account.

/** "Email me a link." Always resolves — the API never says whether the address exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiFetch<{ requested: boolean }>("/api/password-setup/request", {
    method: "POST",
    body: { email },
  });
}

/** Checks a link without consuming it, so the screen can say "expired" before anything is typed. */
export async function verifyPasswordToken(token: string): Promise<PasswordTokenCheck> {
  const { data } = await apiFetch<PasswordTokenCheck>("/api/password-setup/verify", {
    method: "POST",
    body: { token },
  });
  return data;
}

/** Redeems the link and sets the password. Works exactly once per link. */
export async function completePasswordSetup(token: string, password: string): Promise<void> {
  await apiFetch<{ email: string }>("/api/password-setup/complete", {
    method: "POST",
    body: { token, password },
  });
}

/** Admin-triggered reset for a member of staff. Emails the link, and hands it back to pass on by hand. */
export async function sendUserPasswordReset(userId: string): Promise<PasswordResetInvite> {
  const { data } = await apiFetch<PasswordResetInvite>(`/api/users/${userId}/password-reset`, {
    method: "POST",
  });
  return data;
}

/**
 * Sends the "choose your password" invitation AGAIN, for somebody who never
 * got the first one.
 *
 * A different endpoint from the reset above, not a nicer name for it: the
 * backend refuses this one once the account has a password, so "resend the
 * invitation" cannot quietly become "reset a working password".
 */
export async function resendUserInvite(userId: string): Promise<PasswordResetInvite> {
  const { data } = await apiFetch<PasswordResetInvite>(`/api/users/${userId}/resend-invite`, {
    method: "POST",
  });
  return data;
}
