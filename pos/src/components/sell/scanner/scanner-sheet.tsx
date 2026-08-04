"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert } from "@/components/ui/alert";
import { BarcodeScanner } from "@/components/sell/scanner/barcode-scanner";
import type { TransientMessage } from "@/hooks/use-transient-message";

interface ScannerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
  // The screen's own "added to the cart" / "no such barcode" feedback,
  // repeated in here because the sheet covers the page while several items
  // are scanned in a row — otherwise the cashier would be scanning blind.
  feedback: TransientMessage | null;
}

// Hosts the camera. Mounted only while open, so closing the sheet unmounts
// the scanner and hands the camera back to the phone — leaving it running
// behind a closed sheet would keep the camera indicator on all shift and
// drain the battery.
export function ScannerSheet({ open, onOpenChange, onDetected, feedback }: ScannerSheetProps) {
  const t = useTranslations("sell.scanner");
  const tCommon = useTranslations("common");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={tCommon("close")} className="max-h-[90dvh]">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-5">
          {open && <BarcodeScanner onDetected={onDetected} />}
          {feedback && <Alert variant={feedback.variant}>{feedback.text}</Alert>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
