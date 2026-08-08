import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@shared/constants/languages";
import ar from "@/lib/email/messages/ar.json";
import en from "@/lib/email/messages/en.json";
import he from "@/lib/email/messages/he.json";
import type { SupportedLanguage } from "@/types/common";

// Translations for the emails the backend sends.
//
// Same shape as the frontends' next-intl catalogues (one JSON file per
// language, dotted keys, {placeholders}) so a translator sees one system, not
// two — but next-intl itself is a Next.js library and this is Express, so the
// lookup is these fifteen lines instead. CLAUDE.md rule 12 holds either way:
// nothing user-facing is written in a .ts file.

const CATALOGUES: Record<SupportedLanguage, unknown> = { ar, en, he };

/** Languages that read right-to-left. Drives `dir` and the alignment of every cell. */
const RTL_LANGUAGES: readonly SupportedLanguage[] = ["ar", "he"];

export function isRtl(language: SupportedLanguage): boolean {
  return RTL_LANGUAGES.includes(language);
}

export function resolveLanguage(requested: string | null | undefined): SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(requested ?? "")
    ? (requested as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

function lookup(catalogue: unknown, key: string): string | null {
  let node: unknown = catalogue;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : null;
}

/**
 * Translate `key` into `language`, filling `{placeholders}` from `values`.
 * Falls back to the default language when a translation is missing
 * (CLAUDE.md rule 9), and — if even that is missing — to the key itself,
 * which makes the gap obvious in a preview instead of rendering "undefined".
 */
export function t(
  language: SupportedLanguage,
  key: string,
  values: Record<string, string | number> = {}
): string {
  const template = lookup(CATALOGUES[language], key) ?? lookup(CATALOGUES[DEFAULT_LANGUAGE], key) ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}
