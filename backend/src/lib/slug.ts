import slugify from "slugify";

// Transliterates Arabic ("فستان سهرة" -> "fstan-shrh"), so one helper works for every language.
export function toSlug(text: string): string {
  return slugify(text, { lower: true, strict: true }) || "item";
}

// Collisions get a numeric suffix: "evening-dress", "evening-dress-2", … (rule 16).
export async function generateUniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = toSlug(base);
  let candidate = root;
  let n = 1;
  while (await exists(candidate)) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}
