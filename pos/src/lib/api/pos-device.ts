import type { PosDeviceEnrollment, PosDeviceMemberSummary, PosUnlockResult } from "@store/shared/types/posDevice";
import { apiFetch } from "@/lib/api/client";
import { POS_DEVICE_ENDPOINTS } from "@/constants/api";
import type { PosDeviceCredentials } from "@/types/auth";

export async function enrollDevice(credentials: PosDeviceCredentials | null): Promise<PosDeviceEnrollment> {
  const { data } = await apiFetch<PosDeviceEnrollment>(POS_DEVICE_ENDPOINTS.ENROLL, {
    method: "POST",
    body: credentials ?? {},
  });
  return data;
}

export async function savePasscode(passcode: string): Promise<void> {
  await apiFetch<{ hasPasscode: boolean }>(POS_DEVICE_ENDPOINTS.PASSCODE, { method: "POST", body: { passcode } });
}

export async function fetchDeviceMembers(credentials: PosDeviceCredentials): Promise<PosDeviceMemberSummary[]> {
  const { data } = await apiFetch<PosDeviceMemberSummary[]>(POS_DEVICE_ENDPOINTS.MEMBERS, {
    method: "POST",
    body: credentials,
  });
  return data;
}

export async function unlockDevice(
  credentials: PosDeviceCredentials,
  userId: string,
  passcode: string,
): Promise<PosUnlockResult> {
  const { data } = await apiFetch<PosUnlockResult>(POS_DEVICE_ENDPOINTS.UNLOCK, {
    method: "POST",
    body: { ...credentials, userId, passcode },
  });
  return data;
}

export async function leaveDevice(credentials: PosDeviceCredentials): Promise<void> {
  await apiFetch<{ left: boolean }>(POS_DEVICE_ENDPOINTS.LEAVE, { method: "POST", body: credentials });
}
