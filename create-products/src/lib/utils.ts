import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[؀-ۿ\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export function generateSKU(title: string, optionValues: string[] = []): string {
  const titleCode = title.trim().split(/\s+/).slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "X").join("");
  const optCodes = optionValues.map((v) =>
    v.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase()
  );
  const base = [titleCode, ...optCodes].filter(Boolean).join("-");
  let hash = 0;
  for (let i = 0; i < base.length; i++)
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  return `${base}-${String(Math.abs(hash) % 9000 + 1000)}`;
}

export function generateBarcode(seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++)
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  const raw = String(Math.abs(hash)).padStart(12, "0").slice(0, 12);
  const sum = raw.split("").reduce((a, d, i) => a + parseInt(d) * (i % 2 === 0 ? 1 : 3), 0);
  return raw + (10 - (sum % 10)) % 10;
}

export function generateCombinations(
  options: Array<{ title: string; values: string[] }>
): Array<Record<string, string>> {
  const filled = options.filter((o) => o.values.length > 0);
  if (!filled.length) return [];
  const cartesian = (arrays: string[][]): string[][] =>
    arrays.reduce(
      (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
      [[]] as string[][]
    );
  return cartesian(filled.map((o) => o.values)).map((combo) => {
    const result: Record<string, string> = {};
    filled.forEach((opt, i) => { result[opt.title] = combo[i]; });
    return result;
  });
}
