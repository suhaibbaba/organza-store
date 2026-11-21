import {
  HEX_COLOR_PATTERN,
  IMAGE_BRIGHTNESS_LIGHT_THRESHOLD,
  MIN_POINT_CONTRAST_RATIO,
  POINT_COLORS_FALLBACK,
  POINT_COLORS_FOR_DARK_IMAGE,
  POINT_COLORS_FOR_LIGHT_IMAGE,
  POINT_TEXT_CONTRAST_FALLBACKS,
  type PointColors,
} from "@/constants/numberedShawl";

// Numbered-shawl marker colours, one pair per product: the shop's choice wins, else suggested from photo brightness, always legible.

export type { PointColors };

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value.trim());
}

/** `#abc` / `#aabbcc` → channels 0–255. Null for anything else. */
export function parseHexColor(value: string): RgbColor | null {
  const hex = value.trim();
  if (!isHexColor(hex)) {
    return null;
  }
  const digits =
    hex.length === 4
      ? hex
          .slice(1)
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.slice(1);
  return {
    r: parseInt(digits.slice(0, 2), 16),
    g: parseInt(digits.slice(2, 4), 16),
    b: parseInt(digits.slice(4, 6), 16),
  };
}

/** #abc to #AABBCC for colour inputs; null for a non-hex string. */
export function normalizeHexColor(value: string): string | null {
  const rgb = parseHexColor(value);
  if (!rgb) {
    return null;
  }
  const hex = (channel: number) => channel.toString(16).padStart(2, "0");
  return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`.toUpperCase();
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function relativeLuminance(color: RgbColor): number {
  return 0.2126 * channelLuminance(color.r) + 0.7152 * channelLuminance(color.g) + 0.0722 * channelLuminance(color.b);
}

/** WCAG contrast ratio between two hex colours, 1 – 21. */
export function contrastRatio(a: string, b: string): number {
  const colorA = parseHexColor(a);
  const colorB = parseHexColor(b);
  if (!colorA || !colorB) {
    return 1;
  }
  const lumA = relativeLuminance(colorA);
  const lumB = relativeLuminance(colorB);
  const [light, dark] = lumA >= lumB ? [lumA, lumB] : [lumB, lumA];
  return (light + 0.05) / (dark + 0.05);
}

/** The pair suiting a photo's brightness; null brightness keeps the original marker. */
export function suggestPointColors(brightness: number | null | undefined): PointColors {
  if (brightness == null || Number.isNaN(brightness)) {
    return POINT_COLORS_FALLBACK;
  }
  return brightness >= IMAGE_BRIGHTNESS_LIGHT_THRESHOLD ? POINT_COLORS_FOR_LIGHT_IMAGE : POINT_COLORS_FOR_DARK_IMAGE;
}

/** Keeps the number readable on its badge by moving only the text colour. */
export function enforceTextContrast(text: string, background: string): string {
  if (contrastRatio(text, background) >= MIN_POINT_CONTRAST_RATIO) {
    return text;
  }
  let best = POINT_TEXT_CONTRAST_FALLBACKS[0] as string;
  let bestRatio = 0;
  for (const candidate of POINT_TEXT_CONTRAST_FALLBACKS) {
    const ratio = contrastRatio(candidate, background);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
}

export interface PointColorSource {
  /** Product.pointTextColor — null means "suggest one from the photo". */
  pointTextColor?: string | null;
  /** Product.pointBackgroundColor — null means the same. */
  pointBackgroundColor?: string | null;
}

export interface ResolvedPointColors extends PointColors {
  /** True while this half is still following the photo, not a choice. */
  isAutoText: boolean;
  isAutoBackground: boolean;
  /** True when the chosen pair was too close to read and the text was moved. */
  textAdjustedForContrast: boolean;
}

/** Final colours: the product's choice, else the photo's suggestion, legible either way. */
export function resolvePointColors(
  product: PointColorSource,
  brightness: number | null | undefined,
): ResolvedPointColors {
  const suggestion = suggestPointColors(brightness);

  const chosenText = product.pointTextColor && isHexColor(product.pointTextColor) ? product.pointTextColor : null;
  const chosenBackground =
    product.pointBackgroundColor && isHexColor(product.pointBackgroundColor) ? product.pointBackgroundColor : null;

  const background = chosenBackground ?? suggestion.background;
  const requestedText = chosenText ?? suggestion.text;
  const text = enforceTextContrast(requestedText, background);

  return {
    text,
    background,
    isAutoText: chosenText === null,
    isAutoBackground: chosenBackground === null,
    textAdjustedForContrast: text.toLowerCase() !== requestedText.toLowerCase(),
  };
}
