// Where the API suite may point: the live shop is recognised from PRODUCTION_API_URL, and anything unknown fails safe.
import { describe, expect, it } from "vitest";
import { classify } from "@tests/support/target";

describe("API test target", () => {
  it("treats the production API host, its site and its www host as the live shop", () => {
    for (const host of ["api.shop.example", "shop.example", "www.shop.example"]) {
      expect(classify(host, "shop.example"), host).toBe("production");
    }
  });

  it("recognises a sandbox by name and a developer's own machine", () => {
    expect(classify("api.sandbox.shop.example", "shop.example")).toBe("sandbox");
    expect(classify("localhost", "shop.example")).toBe("local");
  });

  it("refuses an unknown host, with or without PRODUCTION_API_URL", () => {
    expect(classify("api.other.example", "shop.example")).toBe("unrecognised");
    expect(classify("api.shop.example", null)).toBe("unrecognised");
    expect(classify("notasandbox.example", null)).toBe("unrecognised");
  });
});
