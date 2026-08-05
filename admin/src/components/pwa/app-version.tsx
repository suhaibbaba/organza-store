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

/**
 * Which build this phone is running — the first question worth asking when
 * staff report that something looks wrong, and the answer an installed PWA
 * otherwise hides completely.
 *
 * Deliberately quiet: small muted text at the foot of the account menu, never
 * a badge or a banner. Tapping it copies both numbers (this app's and the
 * API's), because reading a version down the phone is exactly when a typo
 * costs an hour. The text stays selectable for anyone who would rather
 * long-press it.
 */
export function AppVersion({ className }: AppVersionProps) {
  const t = useTranslations("pwa.version");
  const { data } = useApiVersionQuery();
  const [copied, setCopied] = useState(false);

  const appLine = t("app", { version: APP_VERSION });
  // Absent until the API answers, and left out entirely if it never does —
  // this app's own version is the one that matters most, and it is already
  // on screen.
  const apiLine = data?.version ? t("api", { version: data.version }) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText([appLine, apiLine].filter(Boolean).join(" · "));
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // No clipboard (an insecure context, or permission refused) — the text
      // is on screen and selectable, which is all this ever promised.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={t("copy")}
      className={cn(
        "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-start",
        "text-xs text-muted-foreground transition-colors hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <span className="select-all font-mono">{appLine}</span>
      {apiLine && <span className="select-all font-mono">{apiLine}</span>}
      {copied && (
        <span className="flex items-center gap-1 text-primary">
          <Check className="size-3" aria-hidden="true" />
          {t("copied")}
        </span>
      )}
    </button>
  );
}
