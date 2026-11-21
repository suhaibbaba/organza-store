"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, ScanLine } from "lucide-react";
import { Button, Drawer, Input, SegmentedControl } from "@store/ui";
import { BARCODE_SOURCE } from "@organza/shared/constants/barcode";
import { isValidBarcode, normalizeBarcode } from "@organza/shared/lib/barcode";
import type { BarcodeSource } from "@organza/shared/types/product";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { fieldErrorTestSelector, fieldTestSelector } from "@organza/shared/lib/testSelector";
import { BarcodeInput } from "@/components/fields/barcode-input";
import { BarcodeCamera } from "@/components/products/barcode-camera";
import { cn } from "@/lib/utils";

interface BarcodeFieldProps {
  // Unique per field: the parent's and one per variant.
  id: string;
  source: BarcodeSource;
  // Kept across a toggle so flipping back and forth doesn't make the user retype a scan.
  value: string;
  onChange: (next: { source: BarcodeSource; value: string }) => void;
  // Null on a product not saved yet.
  currentCode: string | null;
  disabled?: boolean;
  // Rendered smaller inside a variant row.
  compact?: boolean;
}

// Reversible: switching back to ours restores the code we minted, so a label already stuck on keeps working (rule 13).
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
  // An empty field on a fresh toggle is where the user is about to scan, not an error.
  const invalid = isSupplier && trimmed.length > 0 && !isValidBarcode(trimmed);

  const label = (
    <label htmlFor={isSupplier ? id : undefined} className="text-label text-ink">
      {t("label")}
    </label>
  );

  const sources = compact ? (
    <div
      inert={disabled || undefined}
      aria-disabled={disabled || undefined}
      className={cn("shrink-0 [&>*]:w-max", disabled && "opacity-50")}
    >
      <SegmentedControl
        label={t("label")}
        value={source}
        onChange={(next) => onChange({ source: next, value })}
        options={[
          { value: BARCODE_SOURCE.GENERATED, label: t("generated.title") },
          { value: BARCODE_SOURCE.SUPPLIER, label: t("supplier.title") },
        ]}
      />
    </div>
  ) : (
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
            <Button
              variant="secondary"
              onClick={() => setCameraOpen(true)}
              disabled={disabled}
              aria-label={t("camera.open")}
              className="shrink-0"
              icon={<Camera className="size-5" aria-hidden="true" />}
            />
          </div>

          <p id={`${id}-hint`} className={cn("flex items-start gap-1.5 text-ink-muted", compact ? "text-micro" : "text-label")}>
            <ScanLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("supplier.entryHint")}
          </p>

          {invalid && (
            <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector(id)}>
              {translateError(ERROR_CODES.BARCODE_INVALID)}
            </p>
          )}

          <Drawer
            data-testid="sheet-barcode-camera"
            open={cameraOpen}
            onOpenChange={setCameraOpen}
            title={t("camera.title")}
            descriptionKey="products.form.barcode.camera.subtitle"
          >
            <div className="flex flex-col gap-3">
              <p className="text-label text-ink-muted">{t("camera.subtitle")}</p>
              {/* Mounted only while open, so closing hands the camera back instead of leaving its indicator lit. */}
              {cameraOpen && (
                <BarcodeCamera
                  onDetected={(code) => {
                    onChange({ source: BARCODE_SOURCE.SUPPLIER, value: normalizeBarcode(code) });
                    setCameraOpen(false);
                  }}
                />
              )}
            </div>
          </Drawer>
        </>
      ) : (
        // Read-only: our code is frozen so printed labels keep working.
        <>
          <Input
            id={`${id}-generated`}
            data-test-selector={fieldTestSelector(`${id}-generated`)}
            value={currentCode ?? t("generated.pending")}
            dir="ltr"
            disabled
            readOnly
          />
          <p className={cn("text-ink-muted", compact ? "text-micro" : "text-label")}>
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

function SourceChoice({ isSelected, disabled, onSelect, title, hint }: SourceChoiceProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
      className={cn(
        "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-panel border p-3 text-start transition-colors",
        "focus-darken disabled:cursor-not-allowed disabled:opacity-50",
        isSelected
          ? "bg-selected border-selected-line ring-2 ring-primary-600"
          : "border-line bg-surface text-ink not-disabled:hover:bg-row-hover"
      )}
    >
      <span className="text-value font-medium text-ink">{title}</span>
      <span className="text-micro text-ink-muted">{hint}</span>
    </button>
  );
}
