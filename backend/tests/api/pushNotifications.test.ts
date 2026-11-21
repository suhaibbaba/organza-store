import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Role, type Setting } from "@prisma/client";
import type { PushConfig } from "@store/shared/types/push";
import { apiRequest, uniqueId } from "@tests/support/client";
import { getSession, signIn } from "@tests/support/auth";
import { createSellableProduct } from "@tests/support/orders";
import { randomPalestinePhone } from "@tests/support/phone";
import {
  fakeDevice,
  listDevices,
  readDevice,
  registerDevice,
  settleQuietly,
  unregisterDevice,
  waitForAttempt,
  type FakeDevice,
} from "@tests/support/push";
import { SEEDED_PASSWORD } from "@tests/constants";
import type { OrderDto } from "@tests/types";
import { ERROR_CODES } from "@/constants";
import type { SerializableUser } from "@/types";

// Admins are pushed Manager/Employee sales; test devices are unreachable on purpose, proving a failed push never hurts a sale.

// Without VAPID keys nothing can send, so delivery tests skip loudly instead of failing.
let pushConfig: PushConfig = { configured: false, publicKey: null };

beforeAll(async () => {
  const admin = await getSession("ADMIN");
  const res = await apiRequest<PushConfig>("/api/push/config", { token: admin.token });
  expect(res.status).toBe(200);
  pushConfig = res.data ?? pushConfig;

  if (!pushConfig.configured) {
    console.warn(
      "\n⚠️  Sale-notification tests SKIPPED: the target API has no VAPID keys.\n" +
        "   Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (see backend/.env.example) on the\n" +
        "   deployment being tested — until then it cannot send notifications at all.\n",
    );
  }
});

// Decided per test: whether the server can send is only known once asked.
function skipUnlessConfigured(ctx: { skip: () => void }): boolean {
  if (pushConfig.configured) {
    return false;
  }
  ctx.skip();
  return true;
}

describe("Push subscriptions", () => {
  const device = fakeDevice();

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    await unregisterDevice(admin.token, device);
  });

  it("hands out the server's VAPID public key to a signed-in caller", () => {
    expect(typeof pushConfig.configured).toBe("boolean");
    if (pushConfig.configured) {
      expect(pushConfig.publicKey).toBeTruthy();
    }
  });

  it("requires a session", async () => {
    const res = await apiRequest("/api/push/subscriptions", { method: "POST", body: { endpoint: device.endpoint } });
    expect(res.status).toBe(401);
  });

  it("rejects an endpoint that isn't an https push URL", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest("/api/push/subscriptions", {
      method: "POST",
      token: admin.token,
      body: { endpoint: "javascript:alert(1)", keys: device.keys },
    });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
  });

  it("registers a device, lists it, and removes it again", async (ctx) => {
    if (skipUnlessConfigured(ctx)) {
      return;
    }
    const admin = await getSession("ADMIN");

    const created = await registerDevice(admin.token, device);
    expect(created.status).toBe(201);
    expect(created.data!.endpoint).toBe(device.endpoint);
    expect(created.data!.lastAttemptAt).toBeNull();

    // Re-registering the same device is the same subscription: one row.
    const again = await registerDevice(admin.token, device);
    expect(again.status).toBe(201);
    expect(again.data!.id).toBe(created.data!.id);

    const listed = await listDevices(admin.token);
    expect(listed.filter((entry) => entry.endpoint === device.endpoint)).toHaveLength(1);

    const removed = await unregisterDevice(admin.token, device);
    expect(removed.status).toBe(200);
    expect(await readDevice(admin.token, device)).toBeUndefined();

    // Removing twice is a 404: the caller asked about a device that isn't theirs or isn't there.
    expect((await unregisterDevice(admin.token, device)).status).toBe(404);
  });
});

describe("Sale-notification settings", () => {
  let original: Pick<Setting, "saleNotificationsEnabled" | "saleNotificationMode">;

  beforeAll(async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<Setting>("/api/settings", { token: admin.token });
    original = {
      saleNotificationsEnabled: res.data!.saleNotificationsEnabled,
      saleNotificationMode: res.data!.saleNotificationMode,
    };
  });

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    await apiRequest("/api/settings", { method: "PATCH", token: admin.token, body: original });
  });

  it("exposes the notification settings to any signed-in role", async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest<Setting>("/api/settings", { token: employee.token });
    expect(res.status).toBe(200);
    expect(typeof res.data!.saleNotificationsEnabled).toBe("boolean");
    expect(res.data!.saleNotificationMode).toBe("EVERY_SALE");
    // Money leaves the API as a fixed-2dp string, like every other amount.
    expect(String(res.data!.saleNotificationMinAmount)).toMatch(/^\d+\.\d{2}$/);
  });

  it("lets an Admin turn notifications off and on", async () => {
    const admin = await getSession("ADMIN");

    const off = await apiRequest<Setting>("/api/settings", {
      method: "PATCH",
      token: admin.token,
      body: { saleNotificationsEnabled: false },
    });
    expect(off.status).toBe(200);
    expect(off.data!.saleNotificationsEnabled).toBe(false);

    const on = await apiRequest<Setting>("/api/settings", {
      method: "PATCH",
      token: admin.token,
      body: { saleNotificationsEnabled: true },
    });
    expect(on.data!.saleNotificationsEnabled).toBe(true);
  });

  it("refuses a mode that exists in the schema but isn't implemented yet", async () => {
    const admin = await getSession("ADMIN");
    const res = await apiRequest("/api/settings", {
      method: "PATCH",
      token: admin.token,
      body: { saleNotificationMode: "ABOVE_AMOUNT" },
    });
    expect(res.status).toBe(400);
    expect(res.error?.code).toBe(ERROR_CODES.VALIDATION);
  });

  it("forbids an Employee from changing them", async () => {
    const employee = await getSession("EMPLOYEE");
    const res = await apiRequest("/api/settings", {
      method: "PATCH",
      token: employee.token,
      body: { saleNotificationsEnabled: false },
    });
    expect(res.status).toBe(403);
  });
});

describe("Sale notifications", () => {
  // A second Admin, because "all Admins" and "not the author" need somebody else listening.
  const device: FakeDevice = fakeDevice();
  const otherDevice: FakeDevice = fakeDevice();
  const otherAdmin = { email: `vitest.push-admin.${uniqueId()}@store.test`, id: "", token: "" };
  const openedOrderIds: string[] = [];
  const openedProductIds: string[] = [];

  async function sell(token: string): Promise<OrderDto> {
    const product = await createSellableProduct(token, { basePrice: "250", stock: 20 });
    openedProductIds.push(product.id);

    const res = await apiRequest<OrderDto>("/api/orders", {
      method: "POST",
      token,
      body: { channel: "STORE", items: [{ productId: product.id, quantity: 1 }] },
    });
    expect(res.status).toBe(201);
    openedOrderIds.push(res.data!.id);
    return res.data!;
  }

  async function lastAttempt(): Promise<string | null> {
    const admin = await getSession("ADMIN");
    return (await readDevice(admin.token, device))?.lastAttemptAt ?? null;
  }

  async function otherLastAttempt(): Promise<string | null> {
    return (await readDevice(otherAdmin.token, otherDevice))?.lastAttemptAt ?? null;
  }

  async function setNotifications(enabled: boolean): Promise<void> {
    const admin = await getSession("ADMIN");
    const res = await apiRequest<Setting>("/api/settings", {
      method: "PATCH",
      token: admin.token,
      body: { saleNotificationsEnabled: enabled },
    });
    expect(res.status).toBe(200);
  }

  /** Both Admin devices were notified, for the sale just made. */
  async function expectBothNotified(before: string | null, otherBefore: string | null): Promise<void> {
    const admin = await getSession("ADMIN");
    expect(await waitForAttempt(admin.token, device, before)).not.toBeNull();
    expect(await waitForAttempt(otherAdmin.token, otherDevice, otherBefore)).not.toBeNull();
  }

  beforeAll(async () => {
    if (!pushConfig.configured) {
      return;
    }
    const admin = await getSession("ADMIN");

    await setNotifications(true);
    expect((await registerDevice(admin.token, device)).status).toBe(201);

    const created = await apiRequest<SerializableUser>("/api/users", {
      method: "POST",
      token: admin.token,
      body: {
        name: "Vitest Push Admin",
        email: otherAdmin.email,
        password: SEEDED_PASSWORD,
        role: Role.ADMIN,
        phone: randomPalestinePhone(),
      },
    });
    expect(created.status).toBe(201);
    otherAdmin.id = created.data!.id;

    const signedIn = await signIn(otherAdmin.email, SEEDED_PASSWORD);
    if (!signedIn.session) {
      throw new Error(`Second Admin sign-in failed (HTTP ${signedIn.status}).`);
    }
    otherAdmin.token = signedIn.session.token;

    expect((await registerDevice(otherAdmin.token, otherDevice, "en")).status).toBe(201);
  });

  afterAll(async () => {
    const admin = await getSession("ADMIN");
    await unregisterDevice(admin.token, device);
    if (otherAdmin.token) {
      await unregisterDevice(otherAdmin.token, otherDevice);
    }
    // Staff have no delete endpoint, so the test Admin is deactivated, which also drops it from later recipients.
    if (otherAdmin.id) {
      await apiRequest(`/api/users/${otherAdmin.id}`, {
        method: "PATCH",
        token: admin.token,
        body: { isActive: false },
      });
    }
    if (pushConfig.configured) {
      await setNotifications(true);
    }

    for (const id of openedOrderIds) {
      await apiRequest(`/api/orders/${id}`, { method: "DELETE", token: admin.token });
    }
    for (const id of openedProductIds) {
      await apiRequest(`/api/products/${id}`, { method: "DELETE", token: admin.token });
    }
  });

  it("notifies every Admin's device when a Manager makes a sale", async (ctx) => {
    if (skipUnlessConfigured(ctx)) {
      return;
    }
    const manager = await getSession("MANAGER");
    const before = await lastAttempt();
    const otherBefore = await otherLastAttempt();

    await sell(manager.token);

    await expectBothNotified(before, otherBefore);
  });

  it("notifies every Admin's device when an Employee makes a sale", async (ctx) => {
    if (skipUnlessConfigured(ctx)) {
      return;
    }
    const employee = await getSession("EMPLOYEE");
    const before = await lastAttempt();
    const otherBefore = await otherLastAttempt();

    await sell(employee.token);

    await expectBothNotified(before, otherBefore);
  });

  it("does not notify an Admin about their own sale", async (ctx) => {
    if (skipUnlessConfigured(ctx)) {
      return;
    }
    const before = await lastAttempt();
    const otherBefore = await otherLastAttempt();

    await sell(otherAdmin.token);
    await settleQuietly();

    // The author hears nothing of their own sale.
    expect(await otherLastAttempt()).toBe(otherBefore);
    // An Admin's sale notifies nobody: only Manager and Employee sales do (SALE_NOTIFICATION_TRIGGER_ROLES).
    expect(await lastAttempt()).toBe(before);

    // The pipeline was awake: a Manager's sale right after does come through, to both.
    const manager = await getSession("MANAGER");
    await sell(manager.token);
    await expectBothNotified(before, otherBefore);
  });

  it("sends nothing while the shop has notifications switched off", async (ctx) => {
    if (skipUnlessConfigured(ctx)) {
      return;
    }
    await setNotifications(false);
    const before = await lastAttempt();
    const otherBefore = await otherLastAttempt();
    const manager = await getSession("MANAGER");

    await sell(manager.token);
    await settleQuietly();

    expect(await lastAttempt()).toBe(before);
    expect(await otherLastAttempt()).toBe(otherBefore);

    // Same sale, same seller, switched back on: the silence above was the setting.
    await setNotifications(true);
    await sell(manager.token);
    await expectBothNotified(before, otherBefore);
  });

  it("completes the sale even though every push fails", async (ctx) => {
    if (skipUnlessConfigured(ctx)) {
      return;
    }
    // Every notification here already failed to deliver, and none of that reached the sale.
    const admin = await getSession("ADMIN");
    const manager = await getSession("MANAGER");
    const before = await lastAttempt();

    const order = await sell(manager.token);

    expect(order.status).toBe("COMPLETED");
    expect(order.total).toBe("250.00");
    expect(order.stockDeductedAt).not.toBeNull();

    // The push was attempted and did fail: attempted, never accepted.
    expect(await waitForAttempt(admin.token, device, before)).not.toBeNull();
    expect((await readDevice(admin.token, device))?.lastSuccessAt).toBeNull();

    // And the sale is readable afterwards, exactly as it was written.
    const reread = await apiRequest<OrderDto>(`/api/orders/${order.id}`, { token: admin.token });
    expect(reread.status).toBe(200);
    expect(reread.data!.total).toBe("250.00");
  });
});
