"use client";

import { useTranslations } from "next-intl";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@store/ui";
import { POS_CONTROL_HEIGHT } from "@/constants/controls";
import { cn } from "@/lib/utils";

interface UpdatePromptProps {
  // Activates the waiting build and reloads onto it.
  onUpdate: () => void;
  isUpdating: boolean;
}

// A newer build is waiting: under the top bar, never over the checkout total; updating is the cashier's call.
export function UpdatePrompt({ onUpdate, isUpdating }: UpdatePromptProps) {
  const t = useTranslations("pwa.update");

  return (
    // Below sheets and dialogs (z-50), so an open one still owns the screen.
    <div role="status" className="fixed inset-x-0 top-[var(--top-bar-inset)] z-40 px-3 pt-3">
      <div className={cn("mx-auto flex max-w-md flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-float", POS_CONTROL_HEIGHT)}>
        <div className="flex items-start gap-3">
          <ArrowDownToLine className="mt-0.5 size-5 shrink-0 text-primary-600" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="text-label font-medium text-ink">{t("title")}</p>
            <p className="text-label text-ink-muted">{t("description")}</p>
          </div>
        </div>
        <Button type="button" onClick={onUpdate} isLoading={isUpdating} className="w-full">
          {isUpdating ? t("updating") : t("action")}
        </Button>
      </div>
    </div>
  );
}
