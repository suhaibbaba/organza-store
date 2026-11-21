"use client";

import { useTranslations } from "next-intl";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@store/ui";

interface UpdatePromptProps {
  /** The tap that activates the waiting build and reloads onto it. */
  onUpdate: () => void;
  isUpdating: boolean;
}

// "A new version is ready": an installed app has no reload button, so this is the only way onto a downloaded build.
export function UpdatePrompt({ onUpdate, isUpdating }: UpdatePromptProps) {
  const t = useTranslations("pwa.update");

  return (
    <div
      role="status"
      // Above the bottom nav, below sheets (z-50): an open form still owns the screen.
      className="fixed inset-x-0 bottom-[var(--bottom-bar-inset)] z-40 px-3 pb-3"
      data-test-selector="update-prompt"
    >
      <div className="mx-auto flex max-w-md flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-float">
        <div className="flex items-start gap-3">
          <ArrowDownToLine className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="text-label font-medium text-ink">{t("title")}</p>
            <p className="text-label text-ink-muted">{t("description")}</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onUpdate}
          isLoading={isUpdating}
          data-test-selector="update-prompt-action"
          className="w-full sm:w-auto sm:self-start"
        >
          {isUpdating ? t("updating") : t("action")}
        </Button>
      </div>
    </div>
  );
}
