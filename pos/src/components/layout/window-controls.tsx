"use client";

import { useTranslations } from "next-intl";
import { Minus, X } from "lucide-react";
import { IconButton, useConfirm } from "@store/ui";
import { useDesktopShell } from "@/hooks/use-desktop-shell";
import { closeDesktopWindow, minimizeDesktopWindow } from "@/lib/desktop";
import { cn } from "@/lib/utils";

interface WindowControlsProps {
  // Screens without the top bar (sign-in, lock) pin the controls to the corner instead.
  floating?: boolean;
}

// The desktop window has no title bar, so minimise and close live here; nothing renders in a browser.
export function WindowControls({ floating = false }: WindowControlsProps) {
  const t = useTranslations("desktop");
  const isDesktop = useDesktopShell();
  const { confirm, dialog } = useConfirm("pos-window-close-confirm");

  if (!isDesktop) {
    return null;
  }

  function askToClose() {
    confirm({
      title: "desktop.closeConfirmTitle",
      consequences: [t("closeConfirmConsequence")],
      confirmLabel: "desktop.closeConfirmYes",
      tone: "primary",
      onConfirm: closeDesktopWindow,
    });
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1",
        floating &&
          "fixed end-3 top-[calc(var(--safe-top)+0.75rem)] z-40 rounded-pill bg-surface px-1.5 py-1 shadow-card",
      )}
      data-test-selector="pos-window-controls"
    >
      <IconButton
        label={t("minimize")}
        icon={<Minus aria-hidden="true" />}
        onClick={() => void minimizeDesktopWindow()}
        data-testid="pos-window-minimize"
        className="hit-area"
      />
      <IconButton
        label={t("close")}
        icon={<X aria-hidden="true" />}
        tone="danger"
        onClick={askToClose}
        data-testid="pos-window-close"
        className="hit-area"
      />
      {dialog}
    </div>
  );
}
