"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart, Vibrate, VibrateOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@store/ui";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { SHEET_ACTION } from "@/components/sell/sheet-styles";
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
  // The running cart, so a run of scans can be watched adding up without closing the camera.
  totals: CartTotals;
  // Beep and buzz each have their own switch: a shop too loud for one is usually fine with the other.
  sound: ScanSound;
  vibration: ScanVibration;
}

// Stays open across a whole queue until the cashier closes it; mounted only while open so the camera is released.
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
  const formatMoney = useMoneyFormatter();

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      name="scanner"
      title={t("title")}
      description={t("subtitle")}
      className="max-h-[90dvh]"
    >

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-5">
          {open && (
            <BarcodeScanner
              onDetected={onDetected}
              pulse={pulse}
              // Starting the camera on iOS can interrupt the audio session, so the sound is unlocked again once it is live.
              onStarted={sound.unlock}
            />
          )}

          <div className={cn("grid gap-2", vibration.isSupported ? "grid-cols-2" : "grid-cols-1")}>
            <FeedbackToggle
              isOn={!sound.isMuted}
              onToggle={sound.toggleMute}
              onIcon={<Volume2 className="size-5 shrink-0" aria-hidden="true" />}
              offIcon={<VolumeX className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />}
              label={sound.isMuted ? t("unmute") : t("mute")}
            />

            {/* iOS Safari has no Vibration API, so the switch is not offered there. */}
            {vibration.isSupported && (
              <FeedbackToggle
                isOn={!vibration.isMuted}
                onToggle={vibration.toggleMute}
                onIcon={<Vibrate className="size-5 shrink-0" aria-hidden="true" />}
                offIcon={<VibrateOff className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />}
                label={vibration.isMuted ? t("vibrateOn") : t("vibrateOff")}
              />
            )}
          </div>

          <span className="flex items-center justify-center gap-2 rounded-control bg-inset px-3 py-2 text-label font-semibold text-ink">
            <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
            <span>{t("cartSummary", { count: totals.itemCount })}</span>
            <span className="tabular-nums">{formatMoney(totals.total)}</span>
          </span>

          <Button type="button" onClick={() => onOpenChange(false)} className={`${SHEET_ACTION} w-full`}>
            {t("done")}
          </Button>
        </div>
    </BottomSheet>
  );
}

interface FeedbackToggleProps {
  isOn: boolean;
  onToggle: () => void;
  onIcon: ReactNode;
  offIcon: ReactNode;
  label: string;
}

// aria-pressed rather than a checkbox: the label already says what the tap will do.
function FeedbackToggle({ isOn, onToggle, onIcon, offIcon, label }: FeedbackToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isOn}
      className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-label font-medium text-ink transition-colors hover:bg-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {isOn ? onIcon : offIcon}
      <span className="truncate">{label}</span>
    </button>
  );
}
