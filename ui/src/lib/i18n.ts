"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";

// The components were written against react-i18next's `useTranslation()`;
// this is the same shape on top of next-intl, so they read the app's own
// messages. `t` is ROOT-scoped on purpose: a component translates keys its
// caller hands it (a field's label, a toast's message, a tab's name) as well
// as its own, which all live under `ui.*` (src/messages, merged into each
// app's messages by its i18n/request.ts).
export type UiTranslate = (key: string, values?: Record<string, string | number | Date>) => string;

export interface UiTranslation {
  readonly t: UiTranslate;
  readonly i18n: { readonly language: string };
}

export function useTranslation(): UiTranslation {
  const translate = useTranslations() as unknown as UiTranslate;
  const language = useLocale();

  // An empty key means no text (e.g. a headerless column), as under i18next.
  const t = useCallback<UiTranslate>(
    (key, values) => (key === "" ? "" : translate(key, values)),
    [translate],
  );

  return { t, i18n: { language } };
}
