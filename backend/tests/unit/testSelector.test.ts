// data-test-selector spelling is pinned so a name is guessable and both apps spell an idea alike.
import { describe, expect, it } from "vitest";
import {
  TEST_SELECTOR_ATTRIBUTE,
  fieldErrorTestSelector,
  fieldTestSelector,
  testSelectorFor,
  toSelectorName,
} from "@store/shared/lib/testSelector";

describe("the house spelling", () => {
  it("is lower case and hyphenated, whatever it is built from", () => {
    expect(toSelectorName("categoryId")).toBe("category-id");
    expect(toSelectorName("product.editPrice")).toBe("product-edit-price");
    expect(toSelectorName("Order Status")).toBe("order-status");
    expect(toSelectorName("basePrice")).toBe("base-price");
  });

  it("leaves an id alone", () => {
    // A cuid is already the house spelling.
    expect(toSelectorName("cmt0dazje00197duhnjd8cmhk")).toBe("cmt0dazje00197duhnjd8cmhk");
  });

  it("never leaves a stray hyphen at either end", () => {
    expect(toSelectorName("  spaced out  ")).toBe("spaced-out");
    expect(toSelectorName("__weird__")).toBe("weird");
    expect(toSelectorName("!!!")).toBe("");
  });
});

describe("naming one of many", () => {
  it("gives the family its own name and each member the family's name plus an id", () => {
    expect(testSelectorFor("product-card")).toBe("product-card");
    expect(testSelectorFor("product-card", "cmt0dazje00197duhnjd8cmhk")).toBe("product-card-cmt0dazje00197duhnjd8cmhk");
    // A shawl marker is named by its number, which is what anybody reporting it says.
    expect(testSelectorFor("shawl-point", 4)).toBe("shawl-point-4");
  });

  it("falls back to the family alone when there is nothing to distinguish", () => {
    expect(testSelectorFor("sheet", undefined)).toBe("sheet");
    expect(testSelectorFor("sheet", null)).toBe("sheet");
    expect(testSelectorFor("sheet", "")).toBe("sheet");
  });
});

describe("naming a form field", () => {
  it("names a field after its own id, and its message after the field", () => {
    expect(fieldTestSelector("customer-phone")).toBe("field-customer-phone");
    expect(fieldErrorTestSelector("customer-phone")).toBe("field-customer-phone-error");
    // The default every field applies, so new screens are nameable for free.
    expect(fieldTestSelector("lowStockThreshold")).toBe("field-low-stock-threshold");
  });

  it("has no name to give a control with no id", () => {
    expect(fieldTestSelector(undefined)).toBeUndefined();
    expect(fieldTestSelector("")).toBeUndefined();
    expect(fieldErrorTestSelector(undefined)).toBeUndefined();
  });
});

describe("the attribute itself", () => {
  it("is the one both apps write", () => {
    // Named once, so a rename is one edit.
    expect(TEST_SELECTOR_ATTRIBUTE).toBe("data-test-selector");
  });
});
