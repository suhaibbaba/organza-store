"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart, Volume2, VolumeX } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BarcodeScanner } from "@/components/sell/scanner/barcode-scanner";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import type { CartTotals } from "@/types/cart";
import type { ScanFlash } from "@/types/feedback";

interface ScannerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  // The last read, shown on the viewfinder frame.
  pulse: ScanFlash | null;
  // The cart as it stands, so a run of scans can be watched adding up
  // without closing the camera to check.
  totals: CartTotals;
  isMuted: boolean;
  onToggleMute: () => void;
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
  isMuted,
  onToggleMute,
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
          {open && <BarcodeScanner onDetected={onDetected} pulse={pulse} />}

          <div className="flex items-center justify-between gap-2">
            {/* The icon shows how it stands, the words say what tapping
                does — nobody at a counter should have to work out which. */}
            <button
              type="button"
              onClick={onToggleMute}
              className="flex h-12 items-center gap-2 rounded-lg border border-input px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isMuted ? (
                <VolumeX className="size-5 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Volume2 className="size-5" aria-hidden="true" />
              )}
              {isMuted ? t("unmute") : t("mute")}
            </button>

            <span className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">
              <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
              <span>{t("cartSummary", { count: totals.itemCount })}</span>
              <span className="tabular-nums">{formatMoney(totals.total)}</span>
            </span>
          </div>

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
