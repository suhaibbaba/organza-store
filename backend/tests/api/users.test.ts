import { afterAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { randomPalestinePhone, samePhoneUnderOtherPrefix } from "@tests/support/phone";
import { SEEDED_PASSWORD } from "@tests/constants";
import { ERROR_CODES } from "@/constants";
import type { StaffAccountView } from "@tests/types";

describe("Users", () => {
  const nonce = uniqueId();
  const createdUserIds: string[] = [];

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    // Taken away properly now that staff CAN be deleted: these accounts never
    // did anything, so nothing refuses it and the sandbox is left as it was
    // found. Deactivation is the fallback for any that somehow picked up
    // history mid-run — a leftover inactive row is untidy, a failed teardown
    // that masks a real result is worse.
    for (const id of createdUserIds) {
      const deleted = await apiRequest(`/api/users/${id}`, { method: "DELETE", token: admin.token });
      if (deleted.status !== 200) {
        await apiRequest(`/api/users/${id}`, { method: "PATCH", token: admin.token, body: { isActive: false } });
      }
    }
  });

  it("lets Admin create a staff user with a valid E.164 phone", async () => {
    const admin = await getSession("ADMIN");
    const phone = randomPalestinePhone();

    const res = await apiRequest<StaffAccountView>("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest User ${nonce}`,
        email: `vitest.${nonce}@organza.test`,
        password: SEEDED_PASSWORD,
        role: Role.EMPLOYEE,
        phone,
      },
    });
    expect(res.status).toBe(201);
    createdUserIds.push(res.data!.id);
    expect(res.data!.phone).toBe(phone);
  });

  it("rejects a phone reused under the other Palestine prefix (+970/+972 dual-prefix uniqueness)", async () => {
    const admin = await getSession("ADMIN");
    const phone = randomPalestinePhone();

    const first = await apiRequest<StaffAccountView>("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest Dual A ${nonce}`,
        email: `vitest.dual-a.${nonce}@organza.test`,
        password: SEEDED_PASSWORD,
        role: Role.EMPLOYEE,
        phone,
      },
    });
    expect(first.status).toBe(201);
    createdUserIds.push(first.data!.id);

    const second = await apiRequest("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest Dual B ${nonce}`,
        email: `vitest.dual-b.${nonce}@organza.test`,
        password: SEEDED_PASSWORD,
        role: Role.EMPLOYEE,
        phone: samePhoneUnderOtherPrefix(phone),
      },
    });
    expect(second.status).toBe(409);
    expect(second.error?.code).toBe(ERROR_CODES.PHONE_DUPLICATE);
  });

  it("rejects an invalid phone format", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest Invalid ${nonce}`,
        email: `vitest.invalid.${nonce}@organza.test`,
        password: SEEDED_PASSWORD,
        role: Role.EMPLOYEE,
        phone: "0599123456", // missing the required leading '+'
      },
    });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
  });

  it("rejects an unparseable phone string as a clean 400, not a 500", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest Garbage ${nonce}`,
        email: `vitest.garbage.${nonce}@organza.test`,
        password: SEEDED_PASSWORD,
        role: Role.EMPLOYEE,
        phone: "+not-a-real-phone#$%",
      },
    });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
  });

  it("rejects an empty phone value as a clean 400, not a 500", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest Empty ${nonce}`,
        email: `vitest.empty.${nonce}@organza.test`,
        password: SEEDED_PASSWORD,
        role: Role.EMPLOYEE,
        phone: "",
      },
    });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
  });

  it("says on the staff list who has finished setting up and who has not", async () => {
    const admin = await getSession("ADMIN");

    // Created with no password — invited, and waiting on their link.
    const invited = await apiRequest<StaffAccountView>("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: `Vitest Invited ${nonce}`,
        email: `vitest.invited.${nonce}@organza.test`,
        role: Role.EMPLOYEE,
        phone: randomPalestinePhone(),
      },
    });
    expect(invited.status).toBe(201);
    createdUserIds.push(invited.data!.id);

    // Newest-first, so the account this test just made is on the first page.
    const list = await apiRequest<StaffAccountView[]>("/api/users?pageSize=50", { token: admin.token });
    expect(list.status).toBe(200);

    const row = list.data!.find((user) => user.id === invited.data!.id);
    // Enabled, but nobody can sign in as them yet: the two are different
    // questions and the screen has to be able to ask both.
    expect(row?.isActive).toBe(true);
    expect(row?.hasPassword).toBe(false);

    // The password is never on the wire in any shape, not even as a length.
    expect(JSON.stringify(row)).not.toContain("password\":\"");

    // Setting one from the Admin's own box flips it — the same flag the
    // emailed link flips (tests/api/passwordSetup.test.ts).
    await apiRequest(`/api/users/${invited.data!.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { password: SEEDED_PASSWORD },
    });
    const after = await apiRequest<StaffAccountView>(`/api/users/${invited.data!.id}`, { token: admin.token });
    expect(after.data!.hasPassword).toBe(true);
  });

  it("forbids Manager and Employee from reading the staff list (idNumber never leaves the backend for non-admins)", async () => {
    const manager = await getSession("MANAGER");
    const employee = await getSession("EMPLOYEE");

    const managerRes = await apiRequest("/api/users", { token: manager.token });
    const employeeRes = await apiRequest("/api/users", { token: employee.token });

    expect(managerRes.status).toBe(403);
    expect(managerRes.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    expect(employeeRes.status).toBe(403);
    expect(employeeRes.error?.code).toBe(ERROR_CODES.FORBIDDEN);
  });
});
