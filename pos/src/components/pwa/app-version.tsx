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

// Which build this phone runs, quiet at the foot of the account menu; a tap copies both versions.
export function AppVersion({ className }: AppVersionProps) {
  const t = useTranslations("pwa.version");
  const { data } = useApiVersionQuery();
  const [copied, setCopied] = useState(false);

  const appLine = t("app", { version: APP_VERSION });
  // Left out until (or unless) the API answers; this app's own version is the one that matters.
  const apiLine = data?.version ? t("api", { version: data.version }) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText([appLine, apiLine].filter(Boolean).join(" · "));
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // No clipboard: the text is on screen and selectable, which is all this promised.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={t("copy")}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded-control px-2 py-1.5 text-start",
        "text-micro text-ink-muted transition-colors hover:bg-inset",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
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
