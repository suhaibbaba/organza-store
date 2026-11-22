import { afterEach, describe, expect, it } from "vitest";
import { passkeyOrigins, passkeyRpId } from "@/lib/passkeyConfig";

const saved = { cors: process.env.CORS_ORIGINS, rpId: process.env.PASSKEY_RP_ID };

function withOrigins(origins: string, rpId?: string) {
  process.env.CORS_ORIGINS = origins;
  if (rpId === undefined) {
    delete process.env.PASSKEY_RP_ID;
  } else {
    process.env.PASSKEY_RP_ID = rpId;
  }
}

afterEach(() => {
  process.env.CORS_ORIGINS = saved.cors;
  if (saved.rpId === undefined) {
    delete process.env.PASSKEY_RP_ID;
  } else {
    process.env.PASSKEY_RP_ID = saved.rpId;
  }
});

describe("passkey relying party", () => {
  it("is the domain the admin and the POS share, so one passkey opens both", () => {
    withOrigins("https://admin.example-shop.com,https://pos.example-shop.com");
    expect(passkeyRpId()).toBe("example-shop.com");
  });

  it("keeps a sandbox's passkeys apart from production's", () => {
    withOrigins("https://admin.sandbox.example-shop.com,https://pos.sandbox.example-shop.com");
    expect(passkeyRpId()).toBe("sandbox.example-shop.com");
  });

  it("is localhost for local development on any port", () => {
    withOrigins("http://localhost:3000,http://localhost:3001");
    expect(passkeyRpId()).toBe("localhost");
  });

  it("never falls back to a bare top-level domain", () => {
    withOrigins("https://admin.one-shop.com,https://pos.other-shop.com");
    expect(passkeyRpId()).toBeUndefined();
  });

  it("lets PASSKEY_RP_ID override the derived domain", () => {
    withOrigins("https://admin.example-shop.com", "shop.example");
    expect(passkeyRpId()).toBe("shop.example");
  });

  it("accepts only the apps' own origins", () => {
    withOrigins("https://admin.example-shop.com,https://pos.example-shop.com");
    expect(passkeyOrigins()).toEqual(["https://admin.example-shop.com", "https://pos.example-shop.com"]);
  });
});
