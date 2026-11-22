// POS quick unlock (spec.md "POS passcode and lock"): a password sign-in joins a tablet, the server checks every passcode.
import { afterAll, describe, expect, it } from "vitest";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession, signIn } from "@tests/support/auth";
import { randomPalestinePhone } from "@tests/support/phone";
import { SEEDED_PASSWORD } from "@tests/constants";
import { ERROR_CODES } from "@/constants";
import { PASSCODE_MAX_ATTEMPTS } from "@store/shared/constants/posLock";
import type { PosDeviceEnrollment, PosDeviceMemberSummary, PosUnlockResult } from "@store/shared/types/posDevice";
import type { StaffAccountView } from "@tests/types";

const PASSCODE = "482915";
const WRONG_PASSCODE = "000000";

describe("POS passcode", () => {
  const strays: string[] = [];

  async function staffOnNewDevice(label: string) {
    const admin = await getSession("ADMIN");
    const created = await apiRequest<StaffAccountView>("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest ${label}`,
        email: `vitest.${label}.${uniqueId()}@store.test`,
        password: SEEDED_PASSWORD,
        role: "EMPLOYEE",
        phone: randomPalestinePhone(),
      },
    });
    expect(created.status, "the fixture account must be created").toBe(201);
    strays.push(created.data!.id);
    const token = (await signIn(created.data!.email, SEEDED_PASSWORD)).session!.token;
    const enrolled = await apiRequest<PosDeviceEnrollment>("/api/pos-devices/enroll", {
      method: "POST",
      token,
      body: {},
    });
    expect(enrolled.status).toBe(200);
    const device = { deviceId: enrolled.data!.deviceId, deviceSecret: enrolled.data!.deviceSecret! };
    return { account: created.data!, token, device, enrollment: enrolled.data! };
  }

  function unlock(device: { deviceId: string; deviceSecret: string }, userId: string, passcode: string) {
    return apiRequest<PosUnlockResult>("/api/pos-devices/unlock", {
      method: "POST",
      body: { ...device, userId, passcode },
    });
  }

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    for (const id of strays) {
      await apiRequest(`/api/users/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  it("enrolling needs a password session", async () => {
    const res = await apiRequest("/api/pos-devices/enroll", { method: "POST", body: {} });
    expect(res.status).toBe(401);
  });

  it("a new device gets its secret once, and a person shows on its lock screen only after setting a passcode", async () => {
    const { account, token, device, enrollment } = await staffOnNewDevice("pos-enroll");
    expect(enrollment.deviceSecret).toBeTruthy();
    expect(enrollment.hasPasscode).toBe(false);

    const before = await apiRequest<PosDeviceMemberSummary[]>("/api/pos-devices/members", {
      method: "POST",
      body: device,
    });
    expect(before.data!.some((m) => m.userId === account.id)).toBe(false);

    const set = await apiRequest("/api/pos-devices/passcode", { method: "POST", token, body: { passcode: PASSCODE } });
    expect(set.status).toBe(200);

    const after = await apiRequest<PosDeviceMemberSummary[]>("/api/pos-devices/members", {
      method: "POST",
      body: device,
    });
    expect(after.data!.find((m) => m.userId === account.id)?.locked).toBe(false);

    const again = await apiRequest<PosDeviceEnrollment>("/api/pos-devices/enroll", {
      method: "POST",
      token,
      body: device,
    });
    expect(again.data!.deviceId).toBe(device.deviceId);
    expect(again.data!.deviceSecret).toBeNull();
  });

  it("refuses a passcode that is not six digits", async () => {
    const { token } = await staffOnNewDevice("pos-format");
    const res = await apiRequest("/api/pos-devices/passcode", { method: "POST", token, body: { passcode: "12ab" } });
    expect(res.status).toBe(400);
  });

  it("the right passcode opens a real session; a wrong device secret learns nothing", async () => {
    const { account, token, device } = await staffOnNewDevice("pos-unlock");
    await apiRequest("/api/pos-devices/passcode", { method: "POST", token, body: { passcode: PASSCODE } });

    const opened = await unlock(device, account.id, PASSCODE);
    expect(opened.status).toBe(200);
    const me = await apiRequest<{ id: string }>("/api/me", { token: opened.data!.token });
    expect(me.data!.id).toBe(account.id);

    const forged = await unlock({ ...device, deviceSecret: "forged" }, account.id, PASSCODE);
    expect(forged.status).toBe(401);
    expect(forged.error?.code).toBe(ERROR_CODES.POS_DEVICE_UNKNOWN);
  });

  it(`locks the person on this device after ${PASSCODE_MAX_ATTEMPTS} wrong tries until they use their password`, async () => {
    const { account, token, device } = await staffOnNewDevice("pos-lockout");
    await apiRequest("/api/pos-devices/passcode", { method: "POST", token, body: { passcode: PASSCODE } });

    for (let attempt = 1; attempt < PASSCODE_MAX_ATTEMPTS; attempt++) {
      const res = await unlock(device, account.id, WRONG_PASSCODE);
      expect(res.error?.code).toBe(ERROR_CODES.POS_PASSCODE_WRONG);
    }
    const last = await unlock(device, account.id, WRONG_PASSCODE);
    expect(last.error?.code).toBe(ERROR_CODES.POS_PASSCODE_LOCKED);
    const right = await unlock(device, account.id, PASSCODE);
    expect(right.error?.code).toBe(ERROR_CODES.POS_PASSCODE_LOCKED);

    await apiRequest("/api/pos-devices/enroll", { method: "POST", token, body: device });
    const reopened = await unlock(device, account.id, PASSCODE);
    expect(reopened.status).toBe(200);
  });

  it("signing out on the tablet stops the passcode working there", async () => {
    const { account, token, device } = await staffOnNewDevice("pos-leave");
    await apiRequest("/api/pos-devices/passcode", { method: "POST", token, body: { passcode: PASSCODE } });

    const left = await apiRequest("/api/pos-devices/leave", { method: "POST", token, body: device });
    expect(left.status).toBe(200);
    const res = await unlock(device, account.id, PASSCODE);
    expect(res.error?.code).toBe(ERROR_CODES.POS_DEVICE_UNKNOWN);
  });
});
