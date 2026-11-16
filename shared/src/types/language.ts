import type { SUPPORTED_LANGUAGES } from "@/constants/languages";

// The languages translatable content and the UI are written in — ar (the
// default), en, he. Derived from the constant so adding a fourth is one edit
// (CLAUDE.md rule 9).
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
