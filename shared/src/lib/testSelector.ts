// Element names for diagnosis (CLAUDE.md "Test selectors"), one vocabulary for both apps, kept in production builds.

export const TEST_SELECTOR_ATTRIBUTE = "data-test-selector";

/** The house spelling: lower case, hyphen-separated. */
export function toSelectorName(value: string): string {
  return (
    value
      // camelCase splits into words before lowering.
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/** `<family>-<id>`: the instance half is an id, never a name, phone or price (it ships to production). */
export function testSelectorFor(family: string, instance?: string | number | null): string {
  const suffix = instance === null || instance === undefined ? "" : toSelectorName(String(instance));
  return suffix ? `${family}-${suffix}` : family;
}

/** A form control's default name from its id; an explicit data-test-selector wins. */
export function fieldTestSelector(id?: string): string | undefined {
  const name = id ? toSelectorName(id) : "";
  return name ? `field-${name}` : undefined;
}

/** The message under a field, named after the field it belongs to. */
export function fieldErrorTestSelector(id?: string): string | undefined {
  const field = fieldTestSelector(id);
  return field ? `${field}-error` : undefined;
}
