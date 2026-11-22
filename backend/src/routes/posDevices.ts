import { Router, type Request } from "express";
import {
  enrollPosDeviceSchema,
  posDeviceCredentialsSchema,
  setPasscodeSchema,
  unlockPosDeviceSchema,
  type EnrollPosDeviceInput,
  type PosDeviceCredentialsInput,
  type SetPasscodeInput,
  type UnlockPosDeviceInput,
} from "@/validation/posDevice";
import { asyncHandler } from "@/middleware/asyncHandler";
import { requireAuth } from "@/middleware/auth";
import { validateBody } from "@/middleware/validate";
import { callerKey, createRateLimiter, rateLimit } from "@/middleware/rateLimit";
import { sendOk } from "@/lib/response";
import { enrollOnDevice, leaveDevice, listMembers, setPasscode, unlockWithPasscode } from "@/lib/posDevices";
import { POS_UNLOCK_IP_LIMIT, POS_UNLOCK_IP_WINDOW_MS } from "@/constants";
import type { RequestOrigin } from "@/types";

// POS quick unlock (spec.md "POS passcode and lock"): a password sign-in joins a tablet, then a passcode reopens it.
const router = Router();

const unlockLimiter = createRateLimiter({ limit: POS_UNLOCK_IP_LIMIT, windowMs: POS_UNLOCK_IP_WINDOW_MS });

function originOf(req: Request): RequestOrigin {
  return { ipAddress: callerKey(req), userAgent: req.get("user-agent") ?? null };
}

// POST /api/pos-devices/members — the lock screen's people; the device proves itself with its secret.
router.post(
  "/members",
  rateLimit(unlockLimiter, callerKey),
  validateBody(posDeviceCredentialsSchema),
  asyncHandler(async (req, res) => {
    sendOk(res, await listMembers(req.body as PosDeviceCredentialsInput));
  }),
);

// POST /api/pos-devices/unlock — the passcode, checked here and nowhere else; answers a session token.
router.post(
  "/unlock",
  rateLimit(unlockLimiter, callerKey),
  validateBody(unlockPosDeviceSchema),
  asyncHandler(async (req, res) => {
    sendOk(res, await unlockWithPasscode(req.body as UnlockPosDeviceInput, originOf(req)));
  }),
);

// POST /api/pos-devices/enroll — right after a password sign-in on the tablet.
router.post(
  "/enroll",
  requireAuth,
  validateBody(enrollPosDeviceSchema),
  asyncHandler(async (req, res) => {
    sendOk(res, await enrollOnDevice(req.user!.id, req.body as EnrollPosDeviceInput, originOf(req)));
  }),
);

// POST /api/pos-devices/passcode — set or change the signed-in person's own passcode.
router.post(
  "/passcode",
  requireAuth,
  validateBody(setPasscodeSchema),
  asyncHandler(async (req, res) => {
    await setPasscode(req.user!.id, (req.body as SetPasscodeInput).passcode);
    sendOk(res, { hasPasscode: true });
  }),
);

// POST /api/pos-devices/leave — signing out takes the person off this tablet.
router.post(
  "/leave",
  requireAuth,
  validateBody(posDeviceCredentialsSchema),
  asyncHandler(async (req, res) => {
    await leaveDevice(req.user!.id, req.body as PosDeviceCredentialsInput);
    sendOk(res, { left: true });
  }),
);

export default router;
