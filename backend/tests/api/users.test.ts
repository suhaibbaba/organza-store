import { afterAll, describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession } from "@tests/support/auth";
import { randomPalestinePhone, samePhoneUnderOtherPrefix } from "@tests/support/phone";
import { SEEDED_PASSWORD } from "@tests/constants";
import { ERROR_CODES } from "@/constants";
import type { SerializableUser } from "@/types";

describe("Users", () => {
  const nonce = uniqueId();
  const createdUserIds: string[] = [];

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    // There is no delete endpoint for staff — deactivate instead so the test
    // accounts this run created stop counting as active staff.
    for (const id of createdUserIds) {
      await apiRequest(`/api/users/${id}`, { method: "PATCH", token: admin.token, body: { isActive: false } });
    }
  });

  it("lets Admin create a staff user with a valid E.164 phone", async () => {
    const admin = await getSession("ADMIN");
    const phone = randomPalestinePhone();

    const res = await apiRequest<SerializableUser>("/api/users", {
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

    const first = await apiRequest<SerializableUser>("/api/users", {
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
