// Names every part `<name>` / `<name>-<part>` on both data-testid and data-test-selector.
export interface TestIdProps {
  readonly "data-testid"?: string | undefined;
}

export interface PartAttrs {
  readonly "data-part": string;
  readonly "data-testid"?: string | undefined;
  readonly "data-test-selector"?: string | undefined;
}

function named(name: string): { "data-testid": string; "data-test-selector": string } {
  return { "data-testid": name, "data-test-selector": name };
}

export function parts(root: string, testId: string | undefined): (part?: string) => PartAttrs {
  return (part) => {
    const partName = part === undefined ? root : `${root}-${part}`;

    if (testId === undefined) {
      return { "data-part": partName };
    }

    return { "data-part": partName, ...named(part === undefined ? testId : `${testId}-${part}`) };
  };
}

export function testid(
  id: string | undefined,
  part?: string,
): { "data-testid"?: string; "data-test-selector"?: string } {
  if (id === undefined) {
    return {};
  }

  return named(part === undefined ? id : `${id}-${part}`);
}
