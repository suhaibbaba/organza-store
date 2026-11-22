import type { BadgeTone } from "@ui/components/badge";
import type { IconName } from "@ui/components/icon";

export interface NoticeTone {
  // An alert's tinted strip: background and hairline border.
  readonly tint: string;
  readonly icon: string;
  readonly title: string;
  readonly text: string;
  readonly glyph: IconName;
}

// Alerts and toasts share one light palette drawn from the theme's tone scales, so they follow the client's theme.
export const NOTICE_TONES: Record<BadgeTone, NoticeTone> = {
  danger: {
    tint: "bg-danger-50 border-danger-200",
    icon: "text-danger-600",
    title: "text-danger-800",
    text: "text-danger-700",
    glyph: "error",
  },
  warning: {
    tint: "bg-warning-50 border-warning-300/60",
    icon: "text-warning-500",
    title: "text-warning-800",
    text: "text-warning-700",
    glyph: "alert",
  },
  success: {
    tint: "bg-success-50 border-success-100",
    icon: "text-success-600",
    title: "text-success-800",
    text: "text-success-700",
    glyph: "circle-check",
  },
  info: {
    tint: "bg-primary-50 border-primary-100",
    icon: "text-primary-600",
    title: "text-primary-800",
    text: "text-primary-700",
    glyph: "info",
  },
  neutral: {
    tint: "bg-canvas border-line",
    icon: "text-ink-subtle",
    title: "text-ink",
    text: "text-ink-muted",
    glyph: "circle-help",
  },
};
