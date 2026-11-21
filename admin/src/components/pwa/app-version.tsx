"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { APP_VERSION } from "@/lib/env";
import { useApiVersionQuery } from "@/hooks/use-api-version";
import { COPIED_FEEDBACK_MS } from "@/constants/pwa";
import { cn } from "@/lib/utils";

interface AppVersionProps {
  className?: string;
}

// Which build (app + API) this device runs; tapping copies both, since a misread version costs an hour.
export function AppVersion({ className }: AppVersionProps) {
  const t = useTranslations("pwa.version");
  const { data } = useApiVersionQuery();
  const [copied, setCopied] = useState(false);

  const appLine = t("app", { version: APP_VERSION });
  const apiLine = data?.version ? t("api", { version: data.version }) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText([appLine, apiLine].filter(Boolean).join(" · "));
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // No clipboard: the text stays on screen and selectable.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={t("copy")}
      className={cn(
        "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-control px-2 py-1.5 text-start",
        "text-meta text-ink-subtle transition-colors duration-150 hover:bg-inset",
        "focus-visible:bg-neutral-200 focus-visible:text-ink",
        className
      )}
    >
      <span className="select-all font-mono">{appLine}</span>
      {apiLine && <span className="select-all font-mono">{apiLine}</span>}
      {copied && (
        <span className="flex items-center gap-1 text-primary-600">
          <Check className="size-3" aria-hidden="true" />
          {t("copied")}
        </span>
      )}
    </button>
  );
}
