import type { BadgeTone } from "@ui/components/badge";
import type { IconName } from "@ui/components/icon";

export interface NoticeTone {
  readonly surface: string;
  readonly icon: string;
  readonly title: string;
  readonly text: string;
  readonly glyph: IconName;
}

// Alerts and toasts share one dark palette; it does not follow the page theme on purpose.
export const NOTICE_TONES: Record<BadgeTone, NoticeTone> = {
  danger: {
    surface: "bg-toast-error",
    icon: "text-toast-error-icon",
    title: "text-toast-error-title",
    text: "text-toast-error-text",
    glyph: "error",
  },
  warning: {
    surface: "bg-toast-warning",
    icon: "text-toast-warning-icon",
    title: "text-toast-warning-title",
    text: "text-toast-warning-text",
    glyph: "alert",
  },
  success: {
    surface: "bg-toast-success",
    icon: "text-toast-success-icon",
    title: "text-toast-success-title",
    text: "text-toast-success-text",
    glyph: "circle-check",
  },
  info: {
    surface: "bg-toast-info",
    icon: "text-toast-info-icon",
    title: "text-toast-info-title",
    text: "text-toast-info-text",
    glyph: "info",
  },
  neutral: {
    surface: "bg-toast-neutral",
    icon: "text-toast-neutral-icon",
    title: "text-toast-neutral-title",
    text: "text-toast-neutral-text",
    glyph: "circle-help",
  },
};
