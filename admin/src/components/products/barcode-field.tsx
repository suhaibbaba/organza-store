"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, ScanLine } from "lucide-react";
import { BARCODE_SOURCE } from "@organza/shared/constants/barcode";
import { isValidBarcode, normalizeBarcode } from "@organza/shared/lib/barcode";
import type { BarcodeSource } from "@organza/shared/types/product";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarcodeInput } from "@/components/ui/barcode-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
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

  const label = <Label htmlFor={isSupplier ? id : undefined}>{t("label")}</Label>;

  // Two boxes with an explanation each on the product's own card, where this
  // decision is being made for the first time and there is room to explain
  // it. A segmented control inside a variant, where it is being repeated for
  // the twelfth time and the words are already known — sized to what it says
  // rather than to a whole row of the card (CLAUDE.md "Admin layout
  // conventions").
  const sources = compact ? (
    // Inside a variant row the two options are a plain tab row, and get the
    // shared control's behaviour with them: each segment the width of its own
    // label, on one line, scrolling rather than wrapping in a narrow row.
    <SegmentedControl
      label={t("label")}
      value={source}
      onChange={(next) => onChange({ source: next, value })}
      disabled={disabled}
      options={[
        { value: BARCODE_SOURCE.GENERATED, label: t("generated.title") },
        { value: BARCODE_SOURCE.SUPPLIER, label: t("supplier.title") },
      ]}
    />
  ) : (
    // On the product's own card each option is a card with its explanation
    // under it — two boxes, not a tab row.
    <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("label")}>
      <SourceChoice
        isSelected={!isSupplier}
        disabled={disabled}
        onSelect={() => onChange({ source: BARCODE_SOURCE.GENERATED, value })}
        title={t("generated.title")}
        hint={t("generated.hint")}
      />
      <SourceChoice
        isSelected={isSupplier}
        disabled={disabled}
        onSelect={() => onChange({ source: BARCODE_SOURCE.SUPPLIER, value })}
        title={t("supplier.title")}
        hint={t("supplier.hint")}
      />
    </div>
  );

  return (
    <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2")}>
      {compact ? (
        // Label and control share one line: a whole row for the word
        // "Barcode" is a row a variant card cannot spare.
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {label}
          {sources}
        </div>
      ) : (
        <>
          {label}
          {sources}
        </>
      )}

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

          <p id={`${id}-hint`} className={cn("flex items-start gap-1.5 text-muted-foreground", compact ? "text-xs" : "text-sm")}>
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
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
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
}

// A big, obvious tap target for each option (CLAUDE.md "Frontend UX": ~44px
// minimum, and the chosen one has to read as chosen across a counter). Used
// on the product's own card, where this decision is being made for the first
// time and there is room to explain it; the variant rows repeat it as a plain
// segmented control instead.
function SourceChoice({ isSelected, disabled, onSelect, title, hint }: SourceChoiceProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
      className={cn(
        "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border p-3 text-start transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        isSelected
          ? "border-primary bg-primary/10 ring-2 ring-primary"
          : "border-border bg-card text-foreground not-disabled:hover:bg-accent/60"
      )}
    >
      <span className="text-base font-medium text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
