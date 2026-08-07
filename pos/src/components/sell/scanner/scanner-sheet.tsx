"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart, Vibrate, VibrateOff, Volume2, VolumeX } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/sell/scanner/barcode-scanner";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { ScanSound } from "@/hooks/use-scan-sound";
import type { ScanVibration } from "@/hooks/use-scan-vibration";
import type { CartTotals } from "@/types/cart";
import type { ScanFlash } from "@/types/feedback";
import { cn } from "@/lib/utils";

interface ScannerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  // The last read, shown on the viewfinder frame.
  pulse: ScanFlash | null;
  // The cart as it stands, so a run of scans can be watched adding up
  // without closing the camera to check.
  totals: CartTotals;
  // The beep and the buzz, each with its own switch — a shop that is too loud
  // for one is usually fine with the other, so neither may take the other down
  // with it.
  sound: ScanSound;
  vibration: ScanVibration;
}

// Hosts the camera for as long as the cashier wants it.
//
// It stays open across item after item — a queue is rung up in one run, and
// a scanner that closed itself after each read made every second item cost
// an extra tap on the scan button. Only the cashier closes it, with the
// button at the bottom (or the ✕), which is also why the running total sits
// in here: the answer to "is it all in?" has to be visible without leaving.
//
// Still mounted only while open, so closing hands the camera back to the
// phone — left running behind a closed sheet it would keep the camera
// indicator lit all shift and eat the battery.
export function ScannerSheet({
  open,
  onOpenChange,
  onDetected,
  pulse,
  totals,
  sound,
  vibration,
}: ScannerSheetProps) {
  const t = useTranslations("sell.scanner");
  const tCommon = useTranslations("common");
  const formatMoney = useMoneyFormatter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={tCommon("close")} className="max-h-[90dvh]">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-5">
          {open && (
            <BarcodeScanner
              onDetected={onDetected}
              pulse={pulse}
              // Starting a camera capture on iOS re-negotiates the device's
              // audio session, which can leave an already-unlocked context
              // interrupted and every beep of the run silent. So the unlock is
              // taken again the moment the camera is actually live.
              onStarted={sound.unlock}
            />
          )}

          {/* The icon shows how each cue stands, the words say what tapping
              does — nobody at a counter should have to work out which. Side by
              side because they are one decision ("how does this till answer
              me?"), and both have to be reachable without scrolling the
              camera off the screen. */}
          <div className={cn("grid gap-2", vibration.isSupported ? "grid-cols-2" : "grid-cols-1")}>
            <FeedbackToggle
              isOn={!sound.isMuted}
              onToggle={sound.toggleMute}
              onIcon={<Volume2 className="size-5 shrink-0" aria-hidden="true" />}
              offIcon={<VolumeX className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
              label={sound.isMuted ? t("unmute") : t("mute")}
            />

            {/* Not offered where it cannot work: iOS Safari has no Vibration
                API, so on an iPhone this is one dead switch fewer. */}
            {vibration.isSupported && (
              <FeedbackToggle
                isOn={!vibration.isMuted}
                onToggle={vibration.toggleMute}
                onIcon={<Vibrate className="size-5 shrink-0" aria-hidden="true" />}
                offIcon={<VibrateOff className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                label={vibration.isMuted ? t("vibrateOn") : t("vibrateOff")}
              />
            )}
          </div>

          <span className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">
            <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
            <span>{t("cartSummary", { count: totals.itemCount })}</span>
            <span className="tabular-nums">{formatMoney(totals.total)}</span>
          </span>

          {/* The way out, said plainly: scanning ends when the cashier says
              it does, not when the app decides an item was enough. */}
          <Button type="button" onClick={() => onOpenChange(false)} className="w-full">
            {t("done")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface FeedbackToggleProps {
  isOn: boolean;
  onToggle: () => void;
  onIcon: ReactNode;
  offIcon: ReactNode;
  label: string;
}

// One cue's switch. `aria-pressed` rather than a checkbox, because what is
// being pressed is a button whose label already says what it will do.
function FeedbackToggle({ isOn, onToggle, onIcon, offIcon, label }: FeedbackToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isOn}
      className="flex h-12 items-center justify-center gap-2 rounded-lg border border-input px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isOn ? onIcon : offIcon}
      <span className="truncate">{label}</span>
    </button>
  );
}
