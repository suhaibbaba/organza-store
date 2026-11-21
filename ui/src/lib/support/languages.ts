// The languages the shop's screens are written in, and which way each one
// reads. Ported from the clinic system's shared package without its zod
// schema; Hebrew replaces Turkish.
export type TextDirection = "rtl" | "ltr";

export type Script = "arabic" | "hebrew" | "latin";

export interface LanguageDefinition {
  readonly code: string;
  readonly dir: TextDirection;
  readonly nativeName: string;
  readonly intlLocale: string;
  readonly script: Script;
}

export const LANGUAGE_DEFINITIONS = [
  { code: "ar", dir: "rtl", nativeName: "العربية", intlLocale: "ar", script: "arabic" },
  { code: "en", dir: "ltr", nativeName: "English", intlLocale: "en-GB", script: "latin" },
  { code: "he", dir: "rtl", nativeName: "עברית", intlLocale: "he", script: "hebrew" },
] as const satisfies readonly LanguageDefinition[];

export type LanguageCode = (typeof LANGUAGE_DEFINITIONS)[number]["code"];

export const LANGUAGE_CODES = LANGUAGE_DEFINITIONS.map((language) => language.code) as [
  LanguageCode,
  ...LanguageCode[],
];

export const DEFAULT_LANGUAGE: LanguageCode = "ar";

export const FALLBACK_LANGUAGE: LanguageCode = "en";

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === "string" && (LANGUAGE_CODES as readonly string[]).includes(value);

export const baseLanguage = (tag: string): string => tag.split("-")[0]?.toLowerCase() ?? "";

export function languageDefinition(code: string): LanguageDefinition {
  const base = baseLanguage(code);

  return (
    LANGUAGE_DEFINITIONS.find((language) => language.code === base) ??
    LANGUAGE_DEFINITIONS.find((language) => language.code === FALLBACK_LANGUAGE)!
  );
}

export const languageDirection = (code: string): TextDirection => languageDefinition(code).dir;

export const isRtlLanguage = (code: string): boolean => languageDirection(code) === "rtl";
