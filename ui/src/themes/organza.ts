import type { ThemeOverride } from "@ui/theme/create-theme";

// Organza — a Store Management client. The clinic system's look as a typed override,
// the same values as themes/organza.css, which is what paints before any JavaScript runs.

export const organzaTheme: ThemeOverride = {
  color: {
    "primary-50": "#f1f7fa",
    "primary-100": "#e1eef5",
    "primary-200": "#c8dfec",
    "primary-300": "#a5c9de",
    "primary-500": "#2e80a8",
    "primary-600": "#1b6f97",
    "primary-700": "#155b7d",
    "primary-800": "#114d6a",
    "primary-900": "#0e3d55",

    "success-50": "#effaf6",
    "success-100": "#dcf3ec",
    "success-300": "#a5e2cd",
    "success-400": "#6dcfb1",
    "success-500": "#39ba97",
    "success-600": "#2ca886",
    "success-700": "#1d7f64",
    "success-800": "#1e7a62",
    "success-900": "#0f7a5d",

    "danger-50": "#fef5f4",
    "danger-100": "#fbeae8",
    "danger-200": "#fce8e6",
    "danger-500": "#c4544a",
    "danger-600": "#b03a31",
    "danger-700": "#a03b31",
    "danger-800": "#7a2720",

    "warning-50": "#fdf8ec",
    "warning-100": "#fbf1da",
    "warning-300": "#e8cb83",
    "warning-500": "#b98a1c",
    "warning-700": "#8f6206",
    "warning-800": "#6e4b04",

    "neutral-50": "#f1f6f7",
    "neutral-100": "#e9f0f2",
    "neutral-200": "#e0eaee",
    "neutral-300": "#c9d8de",
    "neutral-400": "#a3bac6",
    "neutral-500": "#768d99",
    "neutral-600": "#56707c",
    "neutral-700": "#4e6975",
    "neutral-900": "#12303f",

    sunken: "#eff3f5",
    "row-hover": "#f7fbfa",
    "table-head": "#f7fafb",
    "quiet-bg": "#f0f5f6",
    "quiet-ink": "#5a7280",
    rail: "#fbfdfd",

    "tint-3-bg": "#ede8f8",
    "tint-3-ink": "#5b3ea6",
    "tint-5-ink": "#1e7a62",
    "tint-6-bg": "#f2e7ee",
    "tint-6-ink": "#8c3a6b",

    "tag-from": "#dff2eb",
    "tag-to": "#deeaf5",
  },
  shadow: {
    card: "0 12px 28px -18px rgb(27 111 151 / 0.35), 0 2px 6px -3px rgb(27 111 151 / 0.12)",
    "card-hover": "0 18px 34px -18px rgb(27 111 151 / 0.45)",
    "nav-active": "0 8px 18px -10px rgb(27 111 151 / 0.55)",
    float: "0 8px 24px -14px rgb(14 61 85 / 0.35)",
    glass:
      "0 18px 40px -18px rgb(14 61 85 / 0.45), 0 2px 8px -4px rgb(14 61 85 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.75), inset 0 -1px 0 rgb(255 255 255 / 0.2)",
    drawer: "calc(20px * var(--drawer-direction, 1)) 0 48px -16px rgb(27 111 151 / 0.32)",
    now: "0 10px 22px -14px rgb(34 152 122 / 0.5)",
    pill: "0 1px 2px rgb(18 48 63 / 0.08)",
    "field-focus": "0 0 0 0.5px var(--color-primary-600), 0 0 0 3.5px rgb(27 111 151 / 0.15)",
    "field-error-ring": "0 0 0 0.5px var(--color-danger-600), 0 0 0 3.5px rgb(176 58 49 / 0.15)",
  },
};
