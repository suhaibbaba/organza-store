import crypto from "node:crypto";
import { AuditAction, type PosDevice } from "@prisma/client";
import { PASSCODE_MAX_ATTEMPTS, POS_DEVICE_SECRET_BYTES } from "@store/shared/constants/posLock";
import type { PosDeviceEnrollment, PosDeviceMemberSummary, PosUnlockResult } from "@store/shared/types/posDevice";
import type { PosDeviceCredentialsInput } from "@store/shared/schemas/posDevice";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { writeAudit } from "@/lib/audit";
import { hashToken, tokenHashesMatch } from "@/lib/passwordTokens";
import { AUDIT_ENTITY, ERROR_CODES } from "@/constants";
import type { RequestOrigin } from "@/types/posDevice";

// The passcode is only ever checked here: a 6-digit code kept on a tablet could be tried exhaustively in seconds.

async function findDevice(credentials: PosDeviceCredentialsInput): Promise<PosDevice> {
  const device = await prisma.posDevice.findUnique({ where: { id: credentials.deviceId } });
  if (!device || !tokenHashesMatch(device.secretHash, hashToken(credentials.deviceSecret))) {
    throw new AppError(401, ERROR_CODES.POS_DEVICE_UNKNOWN);
  }
  return device;
}

async function hasPasscode(userId: string): Promise<boolean> {
  return (await prisma.posPasscode.count({ where: { userId } })) > 0;
}

// After a password sign-in: the tablet joins (or is created) and this person's lockout on it is lifted.
export async function enrollOnDevice(
  userId: string,
  credentials: Partial<PosDeviceCredentialsInput>,
  origin: RequestOrigin,
): Promise<PosDeviceEnrollment> {
  let device: PosDevice | null = null;
  let deviceSecret: string | null = null;

  if (credentials.deviceId && credentials.deviceSecret) {
    device = await findDevice({ deviceId: credentials.deviceId, deviceSecret: credentials.deviceSecret }).catch(
      () => null,
    );
  }
  // Unknown or forgotten credentials (a wiped database, a removed device): start this tablet afresh.
  if (!device) {
    deviceSecret = crypto.randomBytes(POS_DEVICE_SECRET_BYTES).toString("base64url");
    device = await prisma.posDevice.create({
      data: { secretHash: hashToken(deviceSecret), userAgent: origin.userAgent },
    });
  }

  const existing = await prisma.posDeviceMember.findUnique({
    where: { deviceId_userId: { deviceId: device.id, userId } },
  });
  await prisma.posDeviceMember.upsert({
    where: { deviceId_userId: { deviceId: device.id, userId } },
    create: { deviceId: device.id, userId },
    update: { failedAttempts: 0, lockedAt: null },
  });
  await prisma.posDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });

  if (!existing) {
    await writeAudit({
      userId,
      action: AuditAction.CREATE,
      entityType: AUDIT_ENTITY.POS_DEVICE,
      entityId: device.id,
      newValue: { member: userId },
    });
  }

  return { deviceId: device.id, deviceSecret, hasPasscode: await hasPasscode(userId) };
}

export async function setPasscode(userId: string, passcode: string): Promise<void> {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(passcode);
  const had = await hasPasscode(userId);

  await prisma.posPasscode.upsert({ where: { userId }, create: { userId, hash }, update: { hash } });
  // A new passcode is a fresh start everywhere this person may use it.
  await prisma.posDeviceMember.updateMany({ where: { userId }, data: { failedAttempts: 0, lockedAt: null } });

  await writeAudit({
    userId,
    action: AuditAction.UPDATE,
    entityType: AUDIT_ENTITY.USER,
    entityId: userId,
    newValue: { posPasscode: had ? "CHANGED" : "SET" },
  });
}

// The lock screen's people: active, with a passcode, and members of this very device.
export async function listMembers(credentials: PosDeviceCredentialsInput): Promise<PosDeviceMemberSummary[]> {
  const device = await findDevice(credentials);
  const members = await prisma.posDeviceMember.findMany({
    where: { deviceId: device.id, user: { isActive: true, posPasscode: { isNot: null } } },
    select: { lockedAt: true, user: { select: { id: true, name: true, role: true } } },
    orderBy: { lastUnlockedAt: { sort: "desc", nulls: "last" } },
  });
  return members.map(({ lockedAt, user }) => ({
    userId: user.id,
    name: user.name,
    role: user.role,
    locked: lockedAt !== null,
  }));
}

export async function unlockWithPasscode(
  input: PosDeviceCredentialsInput & { userId: string; passcode: string },
  origin: RequestOrigin,
): Promise<PosUnlockResult> {
  const device = await findDevice(input);
  const member = await prisma.posDeviceMember.findUnique({
    where: { deviceId_userId: { deviceId: device.id, userId: input.userId } },
    include: { user: { select: { isActive: true, posPasscode: { select: { hash: true } } } } },
  });
  if (!member || !member.user.isActive) {
    throw new AppError(401, ERROR_CODES.POS_DEVICE_UNKNOWN);
  }
  const hash = member.user.posPasscode?.hash;
  if (member.lockedAt || !hash) {
    throw new AppError(403, ERROR_CODES.POS_PASSCODE_LOCKED);
  }

  const ctx = await auth.$context;
  if (!(await ctx.password.verify({ hash, password: input.passcode }))) {
    const failed = await prisma.posDeviceMember.update({
      where: { id: member.id },
      data: { failedAttempts: { increment: 1 } },
    });
    if (failed.failedAttempts >= PASSCODE_MAX_ATTEMPTS) {
      await prisma.posDeviceMember.update({ where: { id: member.id }, data: { lockedAt: new Date() } });
      await writeAudit({
        userId: input.userId,
        action: AuditAction.UPDATE,
        entityType: AUDIT_ENTITY.POS_DEVICE,
        entityId: device.id,
        newValue: { passcodeLocked: input.userId },
      });
      throw new AppError(403, ERROR_CODES.POS_PASSCODE_LOCKED);
    }
    throw new AppError(401, ERROR_CODES.POS_PASSCODE_WRONG);
  }

  const now = new Date();
  await prisma.posDeviceMember.update({
    where: { id: member.id },
    data: { failedAttempts: 0, lastUnlockedAt: now },
  });
  await prisma.posDevice.update({ where: { id: device.id }, data: { lastUsedAt: now } });

  // A normal Better Auth session, so every route checks it exactly as it checks a password sign-in.
  const session = await ctx.internalAdapter.createSession(input.userId, false, {
    ipAddress: origin.ipAddress,
    userAgent: origin.userAgent,
  });
  return { token: session.token };
}

// Signing out on a tablet takes this person off it, so their passcode stops working there.
export async function leaveDevice(userId: string, credentials: PosDeviceCredentialsInput): Promise<void> {
  const device = await findDevice(credentials);
  const { count } = await prisma.posDeviceMember.deleteMany({ where: { deviceId: device.id, userId } });
  if (count > 0) {
    await writeAudit({
      userId,
      action: AuditAction.DELETE,
      entityType: AUDIT_ENTITY.POS_DEVICE,
      entityId: device.id,
      oldValue: { member: userId },
    });
  }
}
