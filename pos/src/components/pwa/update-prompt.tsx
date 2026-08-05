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
 * Anchored under the top bar rather than at the bottom like the admin's: the
 * bottom of this screen belongs to the checkout bar, and covering the total
 * mid-sale to advertise an update would be exactly the wrong trade. Updating
 * is the cashier's decision, taken between customers.
 */
export function UpdatePrompt({ onUpdate, isUpdating }: UpdatePromptProps) {
  const t = useTranslations("pwa.update");

  return (
    // Below sheets and dialogs (z-50), so an open one still owns the screen.
    <div role="status" className="fixed inset-x-0 top-[var(--top-bar-inset)] z-40 px-3 pt-3">
      <div className="mx-auto flex max-w-md flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <ArrowDownToLine className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">{t("title")}</p>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <Button type="button" onClick={onUpdate} disabled={isUpdating} className="w-full">
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
