// Email colours as plain hex: an email cannot read a CSS variable or a theme token, so they are written inline.
export const BRAND_COLORS = {
  /** Dark teal — headers, the action button, links. */
  teal: "#235C63",
  /** A darker teal for text that has to stay legible on a light ground. */
  tealDark: "#17444A",
  /** Light green — panels, borders, the button's soft surround. */
  light: "#B5D3CB",
  /** Page background behind the email card. */
  background: "#F4F7F6",
  /** The card itself. */
  surface: "#FFFFFF",
  /** Body text. */
  text: "#1F2A2C",
  /** Secondary text — the fallback link, the footer. */
  muted: "#5B6B6E",
  /** Hairlines. */
  border: "#DCE7E3",
} as const;

// The shop's uploaded favicon, cut by the backend into these square PNGs: tab (32), iOS (180), app icon (192, 512).
export const FAVICON_SIZES = [32, 180, 192, 512] as const;
