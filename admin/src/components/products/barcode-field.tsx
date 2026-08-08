"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, ScanLine } from "lucide-react";
import { BARCODE_SOURCE } from "@shared/constants/barcode";
import { isValidBarcode, normalizeBarcode } from "@shared/lib/barcode";
import type { BarcodeSource } from "@shared/types/product";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ERROR_CODES } from "@shared/constants/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarcodeInput } from "@/components/ui/barcode-input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BarcodeCamera } from "@/components/products/barcode-camera";
import { cn } from "@/lib/utils";

interface BarcodeFieldProps {
  // Unique per field: one product form carries the parent's and one per
  // variant.
  id: string;
  source: BarcodeSource;
  // The supplier's code being typed/scanned. Only meaningful while `source` is
  // SUPPLIER; kept across a toggle so flipping back and forth does not make
  // the user retype what they scanned.
  value: string;
  onChange: (next: { source: BarcodeSource; value: string }) => void;
  // The code stored right now, shown while the generated option is chosen.
  // Null on a product that doesn't exist yet — there is nothing to show until
  // it is saved.
  currentCode: string | null;
  disabled?: boolean;
  // Rendered smaller inside a variant row than as the product's own card.
  compact?: boolean;
}

// Ours, or the one the garment arrived with (shared/constants/barcode.ts).
//
// Two plain choices rather than a switch, because neither option is "off":
// generation is the default and prints a label; the supplier's code is a code
// that already exists on the piece. Reversible at any time — switching back to
// ours restores the code we had before, so a label already printed and stuck on
// the garment keeps working.
export function BarcodeField({
  id,
  source,
  value,
  onChange,
  currentCode,
  disabled,
  compact,
}: BarcodeFieldProps) {
  const t = useTranslations("products.form.barcode");
  const translateError = useTranslateError();
  const [cameraOpen, setCameraOpen] = useState(false);

  const isSupplier = source === BARCODE_SOURCE.SUPPLIER;
  const trimmed = normalizeBarcode(value);
  // Only complained about once there is something to complain about: an empty
  // field on a freshly flipped toggle is where the user is about to scan.
  const invalid = isSupplier && trimmed.length > 0 && !isValidBarcode(trimmed);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={isSupplier ? id : undefined}>{t("label")}</Label>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("label")}>
        <SourceChoice
          isSelected={!isSupplier}
          disabled={disabled}
          onSelect={() => onChange({ source: BARCODE_SOURCE.GENERATED, value })}
          title={t("generated.title")}
          hint={t("generated.hint")}
          compact={compact}
        />
        <SourceChoice
          isSelected={isSupplier}
          disabled={disabled}
          onSelect={() => onChange({ source: BARCODE_SOURCE.SUPPLIER, value })}
          title={t("supplier.title")}
          hint={t("supplier.hint")}
          compact={compact}
        />
      </div>

      {isSupplier ? (
        <>
          <div className="flex items-stretch gap-2">
            <BarcodeInput
              id={id}
              value={value}
              onChange={(next) => onChange({ source: BARCODE_SOURCE.SUPPLIER, value: next })}
              placeholder={t("placeholder")}
              disabled={disabled}
              aria-invalid={invalid}
              aria-describedby={`${id}-hint`}
              className="min-w-0 flex-1"
            />
            {/* The camera is how this gets filled on a phone, which is most of
                the time — the wedge scanner only exists on the counter's
                laptop, and typing thirteen digits by hand is the last resort. */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCameraOpen(true)}
              disabled={disabled}
              aria-label={t("camera.open")}
              className="shrink-0"
            >
              <Camera aria-hidden="true" />
            </Button>
          </div>

          <p id={`${id}-hint`} className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <ScanLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("supplier.entryHint")}
          </p>

          {invalid && <p className="text-sm text-destructive">{translateError(ERROR_CODES.BARCODE_INVALID)}</p>}

          <Sheet open={cameraOpen} onOpenChange={setCameraOpen}>
            <SheetContent side="end" closeLabel={t("camera.close")}>
              <SheetHeader>
                <SheetTitle>{t("camera.title")}</SheetTitle>
                <p className="text-sm text-muted-foreground">{t("camera.subtitle")}</p>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
                {/* Mounted only while open, so closing hands the camera back to
                    the phone instead of leaving its indicator lit. */}
                {cameraOpen && (
                  <BarcodeCamera
                    onDetected={(code) => {
                      onChange({ source: BARCODE_SOURCE.SUPPLIER, value: normalizeBarcode(code) });
                      // One read fills the field and that is the whole job
                      // here — unlike the POS, nothing is being rung up.
                      setCameraOpen(false);
                    }}
                  />
                )}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        // Read-only on purpose: our code is generated and frozen so printed
        // labels keep working. Typing a code by hand IS the supplier case, and
        // that is one tap away above.
        <>
          <Input id={`${id}-generated`} value={currentCode ?? t("generated.pending")} dir="ltr" disabled readOnly />
          <p className="text-sm text-muted-foreground">
            {currentCode ? t("generated.printHint") : t("generated.pendingHint")}
          </p>
        </>
      )}
    </div>
  );
}

interface SourceChoiceProps {
  isSelected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  compact?: boolean;
}

// A big, obvious tap target for each option (CLAUDE.md "Frontend UX": ~44px
// minimum, and the chosen one has to read as chosen across a counter).
function SourceChoice({ isSelected, disabled, onSelect, title, hint, compact }: SourceChoiceProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
      className={cn(
        "flex min-h-12 flex-col justify-center gap-0.5 rounded-xl border p-3 text-start transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        isSelected
          ? "border-primary bg-primary/10 ring-2 ring-primary"
          : "border-border bg-card hover:bg-accent/60"
      )}
    >
      <span className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>{title}</span>
      {!compact && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}
