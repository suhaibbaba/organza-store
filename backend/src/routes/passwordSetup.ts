import { Router } from "express";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asyncHandler } from "@/middleware/asyncHandler";
import { validateBody } from "@/middleware/validate";
import { callerKey, createRateLimiter, rateLimit } from "@/middleware/rateLimit";
import { AppError, sendOk } from "@/lib/response";
import { writeAudit } from "@/lib/audit";
import { revokeAllSessions, setUserPassword } from "@/lib/credentials";
import { sendPasswordSetupEmail } from "@/lib/passwordSetup";
import { passwordTokens } from "@/lib/passwordTokenStore";
import {
  completePasswordSetupSchema,
  requestPasswordResetSchema,
  type CompletePasswordSetupInput,
  type RequestPasswordResetInput,
} from "@/validation/passwordSetup";
import {
  AUDIT_ENTITY,
  ERROR_CODES,
  PASSWORD_RESET_EMAIL_LIMIT,
  PASSWORD_RESET_EMAIL_WINDOW_MS,
  PASSWORD_RESET_IP_LIMIT,
  PASSWORD_RESET_IP_WINDOW_MS,
  PASSWORD_SETUP_REDEEM_LIMIT,
  PASSWORD_SETUP_REDEEM_WINDOW_MS,
} from "@/constants";

// Setting a password from an emailed link: unauthenticated, rate-limited, never revealing an account; token only in bodies.
const router = Router();

const ipLimiter = createRateLimiter({ limit: PASSWORD_RESET_IP_LIMIT, windowMs: PASSWORD_RESET_IP_WINDOW_MS });
const emailLimiter = createRateLimiter({
  limit: PASSWORD_RESET_EMAIL_LIMIT,
  windowMs: PASSWORD_RESET_EMAIL_WINDOW_MS,
});
const redeemLimiter = createRateLimiter({
  limit: PASSWORD_SETUP_REDEEM_LIMIT,
  windowMs: PASSWORD_SETUP_REDEEM_WINDOW_MS,
});

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

// POST /api/password-setup/request — same answer whether or not the address has an account.
router.post(
  "/request",
  rateLimit(ipLimiter, callerKey),
  validateBody(requestPasswordResetSchema),
  // Limited per address and per caller; after validation, so a bad body cannot spend someone's budget.
  rateLimit(emailLimiter, (req) => normalizeEmail((req.body as RequestPasswordResetInput).email)),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail((req.body as RequestPasswordResetInput).email);
    const user = await prisma.user.findUnique({ where: { email } });

    // A deactivated account gets no link either — but says so to nobody.
    if (user && user.isActive) {
      await sendPasswordSetupEmail(user, "RESET");
      await writeAudit({
        userId: user.id,
        action: AuditAction.REQUEST,
        entityType: AUDIT_ENTITY.USER,
        entityId: user.id,
        newValue: { passwordReset: "REQUESTED", source: "SELF_SERVICE" },
      });
    }

    // Always the same body, always 200.
    sendOk(res, { requested: true });
  }),
);

// POST /api/password-setup/verify — is the link still good? Does not consume the token.
router.post(
  "/verify",
  rateLimit(redeemLimiter, callerKey),
  validateBody(completePasswordSetupSchema.pick({ token: true })),
  asyncHandler(async (req, res) => {
    const { token } = req.body as { token: string };
    const stored = await passwordTokens.inspect(token);
    if (!stored) {
      throw new AppError(400, ERROR_CODES.PASSWORD_TOKEN_INVALID);
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new AppError(400, ERROR_CODES.PASSWORD_TOKEN_INVALID);
    }

    // The email is echoed: the token holder already holds the account, and the screen shows whose password it is.
    sendOk(res, { email: user.email, name: user.name, purpose: stored.purpose, expiresAt: stored.expiresAt });
  }),
);

// POST /api/password-setup/complete — redeem the link and set the password
router.post(
  "/complete",
  rateLimit(redeemLimiter, callerKey),
  validateBody(completePasswordSetupSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as CompletePasswordSetupInput;

    // redeem() marks the token used in the same conditional write that checks it, so a replay can only succeed once.
    const redeemed = await passwordTokens.redeem(token);
    if (!redeemed) {
      throw new AppError(400, ERROR_CODES.PASSWORD_TOKEN_INVALID);
    }

    const user = await prisma.user.findUnique({ where: { id: redeemed.userId } });
    if (!user || !user.isActive) {
      throw new AppError(400, ERROR_CODES.PASSWORD_TOKEN_INVALID);
    }

    await setUserPassword(user.id, password);
    // Redeeming a link proves the person reads that mailbox.
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    // Every other session of this account is signed out, or the reset would be decorative.
    await revokeAllSessions(user.id);
    // Belt and braces: redeeming one link burns the rest.
    await passwordTokens.revokeAllForUser(user.id);

    await writeAudit({
      userId: user.id,
      action: AuditAction.UPDATE,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      // What changed, never what to: neither password nor token enters the trail.
      newValue: { passwordSet: true, via: "EMAIL_LINK", purpose: redeemed.purpose },
    });

    sendOk(res, { email: user.email });
  }),
);

export default router;
