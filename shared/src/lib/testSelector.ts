// Naming elements so they can be pointed at (CLAUDE.md "Test selectors").
//
// "The button in the corner" is not a description on a screen that mirrors
// itself in Arabic, and a Tailwind class is not a name — it changes the next
// time the design does. Every element worth diagnosing therefore carries a
// `data-test-selector` saying WHAT IT IS, in one vocabulary shared by the
// admin and the POS so neither can invent its own spelling of the same idea.
//
// Kept in production builds on purpose: the deployed app is where problems
// actually appear, and an attribute that only exists on a developer's machine
// is no use to whoever is standing at the counter describing one.

export const TEST_SELECTOR_ATTRIBUTE = "data-test-selector";

/**
 * The house spelling: lower case, words separated by hyphens, nothing else.
 *
 * Anything a name is built out of goes through here — a field's id
 * (`categoryId` → `category-id`), a permission action (`product.editPrice` →
 * `product-edit-price`), a record id (a cuid passes through unchanged) — so
 * one convention holds however the name was assembled.
 */
export function toSelectorName(value: string): string {
  return value
    // camelCase and PascalCase become separate words before everything is
    // lowered, so `basePrice` is not flattened to `baseprice`.
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * One member of a repeating family: `product-card` for the family itself,
 * `product-card-<id>` for one of them — so a list of forty rows still lets
 * somebody name the third.
 *
 * Never build the instance half out of a customer's name, a phone number or a
 * price: this attribute ships to production, and it is for identifying an
 * element, not for carrying data about one. Ids are what belongs here.
 */
export function testSelectorFor(family: string, instance?: string | number | null): string {
  const suffix = instance === null || instance === undefined ? "" : toSelectorName(String(instance));
  return suffix ? `${family}-${suffix}` : family;
}

/**
 * The default a form control gets from its own id, so every identified field
 * in both apps is nameable without anybody writing the name twice — and so a
 * screen built next year inherits it for free. An explicit
 * `data-test-selector` always wins.
 */
export function fieldTestSelector(id?: string): string | undefined {
  const name = id ? toSelectorName(id) : "";
  return name ? `field-${name}` : undefined;
}

/** The message under a field, named after the field it belongs to. */
export function fieldErrorTestSelector(id?: string): string | undefined {
  const field = fieldTestSelector(id);
  return field ? `${field}-error` : undefined;
}
