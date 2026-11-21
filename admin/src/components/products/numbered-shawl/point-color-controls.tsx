"use client";

import { useTranslations } from "next-intl";
import type { PointColors } from "@organza/shared/constants/numberedShawl";
import { Button } from "@store/ui";
import { ColorInput } from "@/components/fields/color-input";

interface PointColorControlsProps {
  /** The product's stored choice, or null while it still follows the photo. */
  textColor: string | null;
  backgroundColor: string | null;
  /** What this photograph's brightness suggests — the starting point. */
  suggestion: PointColors;
  /** True when the pair chosen was too close to read and the text was moved. */
  adjustedForContrast: boolean;
  onChange: (field: "textColor" | "backgroundColor", value: string) => void;
  onUseSuggestion: () => void;
  disabled?: boolean;
}

// One pair for all numbers: opens on the photo's suggestion, and touching one pins it even through a replaced photo (spec.md "Numbered shawls").
export function PointColorControls({
  textColor,
  backgroundColor,
  suggestion,
  adjustedForContrast,
  onChange,
  onUseSuggestion,
  disabled,
}: PointColorControlsProps) {
  const t = useTranslations("products.form.numberedShawl.colors");
  const isAuto = textColor === null && backgroundColor === null;

  return (
    <div className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-label font-medium text-ink">{t("title")}</span>
        {!isAuto && (
          <Button variant="quiet" size="sm" onClick={onUseSuggestion} disabled={disabled}>
            {t("useSuggestion")}
          </Button>
        )}
      </div>

      <p className="text-label text-ink-muted">{isAuto ? t("autoHint") : t("chosenHint")}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ColorInput
          id="point-background-color"
          label={t("background")}
          value={backgroundColor ?? suggestion.background}
          onChange={(value) => onChange("backgroundColor", value)}
          disabled={disabled}
        />
        <ColorInput
          id="point-text-color"
          label={t("text")}
          value={textColor ?? suggestion.text}
          onChange={(value) => onChange("textColor", value)}
          disabled={disabled}
        />
      </div>

      {adjustedForContrast && <p className="text-label text-ink-muted">{t("contrastAdjusted")}</p>}
    </div>
  );
}
