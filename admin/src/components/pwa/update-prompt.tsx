"use client";

import { useTranslations } from "next-intl";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface UpdatePromptProps {
  /** The tap that activates the waiting build and reloads onto it. */
  onUpdate: () => void;
  isUpdating: boolean;
}

/**
 * "A new version is ready" — shown only when a newer build has actually
 * finished downloading and is waiting to take over (see
 * service-worker-registrar.tsx).
 *
 * Installed from a home screen there is no address bar and no reload button,
 * so without this an old cached build is a dead end: the app looks fine and
 * quietly misbehaves. One sentence, one button, no jargon — nobody using this
 * needs to know what a service worker is.
 *
 * Sits above the bottom navigation and clear of the iOS home indicator
 * (CLAUDE.md "Mobile input & device specifics"), and is dismissible only by
 * updating: the point is that there is always a way forward.
 */
export function UpdatePrompt({ onUpdate, isUpdating }: UpdatePromptProps) {
  const t = useTranslations("pwa.update");

  return (
    <div
      role="status"
      // Sits above the page and just clear of the bottom nav and the iOS home
      // indicator, but below sheets and dialogs (z-50): a half-finished form in
      // an open sheet still owns the screen until it is closed.
      className="fixed inset-x-0 bottom-[var(--bottom-bar-inset)] z-40 px-3 pb-3"
    >
      <div className="mx-auto flex max-w-md flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <ArrowDownToLine className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">{t("title")}</p>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <Button type="button" onClick={onUpdate} disabled={isUpdating} className="w-full sm:w-auto sm:self-start">
          {isUpdating ? (
            <>
              <Spinner />
              {t("updating")}
            </>
          ) : (
            t("action")
          )}
        </Button>
      </div>
    </div>
  );
}
