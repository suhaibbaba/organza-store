import slugify from "slugify";

// Slugify handles Arabic via transliteration (e.g. "فستان سهرة" -> "fstan-shrh"),
// so the same helper works for every supported language's default text.
export function toSlug(text: string): string {
  return slugify(text, { lower: true, strict: true }) || "item";
}

// Appends an incrementing numeric suffix on collision: "evening-dress",
// "evening-dress-2", "evening-dress-3", ...
export async function generateUniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>
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
