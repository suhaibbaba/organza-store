import type { KeyboardEvent } from "react";
import { documentDirection } from "@ui/lib/direction";

const STEP: Readonly<Record<string, 1 | -1>> = { ArrowDown: 1, ArrowUp: -1 };

function stepFor(key: string): 1 | -1 | undefined {
  if (key === "ArrowRight" || key === "ArrowLeft") {
    const forward = documentDirection() === "rtl" ? "ArrowLeft" : "ArrowRight";
    return key === forward ? 1 : -1;
  }

  return STEP[key];
}

export function rovingTarget<TValue extends string>(
  key: string,
  values: readonly TValue[],
  current: TValue,
): TValue | undefined {
  if (values.length === 0) {
    return undefined;
  }

  if (key === "Home") {
    return values[0];
  }

  if (key === "End") {
    return values[values.length - 1];
  }

  const step = stepFor(key);
  if (step === undefined) {
    return undefined;
  }

  const index = Math.max(0, values.indexOf(current));
  return values[(index + step + values.length) % values.length];
}

export function rovingKeyDown<TValue extends string>(
  event: KeyboardEvent<HTMLElement>,
  values: readonly TValue[],
  current: TValue,
  choose: (value: TValue) => void,
): void {
  const next = rovingTarget(event.key, values, current);
  if (next === undefined) {
    return;
  }

  event.preventDefault();
  choose(next);

  const items = event.currentTarget.querySelectorAll<HTMLElement>("[data-roving]");
  items[values.indexOf(next)]?.focus();
}

export function rovingStop<TValue extends string>(
  values: readonly TValue[],
  current: TValue,
): TValue | undefined {
  return values.includes(current) ? current : values[0];
}
