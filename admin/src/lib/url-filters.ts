import { PAGE_SIZE_OPTIONS } from "@store/shared/constants/pagination";
import type { UrlParam, UrlParams } from "@/types/urlFilters";

function oneOf<T extends string>(values: readonly T[]): UrlParam<T> {
  return { parse: (raw) => (values.includes(raw as T) ? (raw as T) : undefined), write: (value) => value };
}

function optional<T>(param: UrlParam<T>): UrlParam<T | null> {
  return { parse: param.parse, write: (value) => (value === null ? null : param.write(value)) };
}

function int(min: number): UrlParam<number> {
  return {
    parse: (raw) => {
      const value = Number(raw);
      return Number.isInteger(value) && value >= min ? value : undefined;
    },
    write: String,
  };
}

const flag: UrlParam<boolean> = {
  parse: (raw) => (raw === "true" ? true : raw === "false" ? false : undefined),
  write: String,
};

// Parsers for list filters kept in the URL; anything unreadable falls back to the page's default.
export const urlParam = {
  text: (): UrlParam<string> => ({ parse: (raw) => raw, write: (value) => value || null }),
  id: (): UrlParam<string | null> => optional({ parse: (raw) => raw || undefined, write: (value) => value }),
  oneOf,
  optionalOneOf: <T extends string>(values: readonly T[]) => optional(oneOf(values)),
  flag: () => flag,
  optionalFlag: () => optional(flag),
  page: () => int(1),
  pageSize: (): UrlParam<number> => {
    const base = int(1);
    return { parse: (raw) => PAGE_SIZE_OPTIONS.find((size) => size === base.parse(raw)), write: String };
  },
  // A value the page fixes itself (collection: unpaid only), so the URL can never change it.
  fixed: <T>(): UrlParam<T> => ({ parse: () => undefined, write: () => null }),
};

export function readUrlFilters<T extends object>(search: URLSearchParams, defaults: T, params: UrlParams<T>): T {
  const result = { ...defaults };
  for (const key of Object.keys(params) as (keyof T & string)[]) {
    const raw = search.get(key);
    if (raw === null) {
      continue;
    }
    const parsed = params[key].parse(raw);
    if (parsed !== undefined) {
      result[key] = parsed;
    }
  }
  return result;
}

export function writeUrlFilters<T extends object>(
  search: URLSearchParams,
  filters: T,
  defaults: T,
  params: UrlParams<T>,
): URLSearchParams {
  const next = new URLSearchParams(search);
  for (const key of Object.keys(params) as (keyof T & string)[]) {
    const written = filters[key] === defaults[key] ? null : params[key].write(filters[key]);
    if (written === null) {
      next.delete(key);
    } else {
      next.set(key, written);
    }
  }
  return next;
}
