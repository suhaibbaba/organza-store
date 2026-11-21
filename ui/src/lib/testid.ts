export interface TestIdProps {
  readonly "data-testid"?: string | undefined;
}

export interface PartAttrs {
  readonly "data-part": string;
  readonly "data-testid"?: string | undefined;
}

export function parts(root: string, testId: string | undefined): (part?: string) => PartAttrs {
  return (part) => {
    const name = part === undefined ? root : `${root}-${part}`;

    if (testId === undefined) {
      return { "data-part": name };
    }

    return {
      "data-part": name,
      "data-testid": part === undefined ? testId : `${testId}-${part}`,
    };
  };
}

export function testid(id: string | undefined, part?: string): { "data-testid"?: string } {
  if (id === undefined) {
    return {};
  }

  return { "data-testid": part === undefined ? id : `${id}-${part}` };
}
