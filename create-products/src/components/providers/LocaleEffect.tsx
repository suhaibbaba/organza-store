"use client";
import { useEffect } from "react";

export function LocaleEffect({ locale, dir }: { locale: string; dir: string }) {
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [locale, dir]);
  return null;
}
