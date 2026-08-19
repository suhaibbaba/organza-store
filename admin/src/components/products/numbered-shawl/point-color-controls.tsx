"use client";

import { useTranslations } from "next-intl";
import type { PointColors } from "@organza/shared/constants/numberedShawl";
import { Button } from "@/components/ui/button";
import { ColorInput } from "@/components/ui/color-input";

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

// The colour of this product's numbers (spec.md "Numbered shawls"), one pair
// for all of them. Presented as a suggestion the shop can overrule rather
// than a decision it has to make: the pickers open on whatever the photo
// suggested, and touching one pins it — including through a replaced
// photograph, which is the point of storing it.
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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{t("title")}</span>
        {!isAuto && (
          <Button type="button" variant="ghost" size="sm" onClick={onUseSuggestion} disabled={disabled}>
            {t("useSuggestion")}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{isAuto ? t("autoHint") : t("chosenHint")}</p>

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

      {adjustedForContrast && <p className="text-sm text-muted-foreground">{t("contrastAdjusted")}</p>}
    </div>
  );
}
