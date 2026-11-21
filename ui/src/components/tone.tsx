import type { BadgeTone } from "@ui/components/badge";

export const TONE_SURFACE: Record<BadgeTone, string> = {
  neutral: "border-line-strong bg-sunken text-ink-muted",
  success: "border-success-300 bg-success-100 text-success-900",
  warning: "border-warning-300 bg-warning-100 text-warning-700",
  danger: "border-danger-200 bg-danger-100 text-danger-600",
  info: "border-primary-200 bg-primary-100 text-primary-600",
};
