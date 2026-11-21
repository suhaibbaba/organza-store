"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";

// react-i18next's useTranslation shape on next-intl; `t` is root-scoped because callers hand it full keys.
export type UiTranslate = (key: string, values?: Record<string, string | number | Date>) => string;

export interface UiTranslation {
  readonly t: UiTranslate;
  readonly i18n: { readonly language: string };
}

export function useTranslation(): UiTranslation {
  const translate = useTranslations() as unknown as UiTranslate;
  const language = useLocale();

  // An empty key means no text (e.g. a headerless column), as under i18next.
  const t = useCallback<UiTranslate>((key, values) => (key === "" ? "" : translate(key, values)), [translate]);

  return { t, i18n: { language } };
}
