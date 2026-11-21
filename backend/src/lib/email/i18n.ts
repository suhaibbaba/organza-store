import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@store/shared/constants/languages";
import ar from "@/lib/email/messages/ar.json";
import en from "@/lib/email/messages/en.json";
import he from "@/lib/email/messages/he.json";
import type { SupportedLanguage } from "@/types/common";

// Email translations in the frontends' JSON shape; a tiny lookup instead of next-intl, which is Next-only.

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
    if (typeof node !== "object" || node === null) {
      return null;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : null;
}

/** Falls back to the default language (rule 9), then to the key itself, so a gap shows in a preview. */
export function t(language: SupportedLanguage, key: string, values: Record<string, string | number> = {}): string {
  const template = lookup(CATALOGUES[language], key) ?? lookup(CATALOGUES[DEFAULT_LANGUAGE], key) ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
