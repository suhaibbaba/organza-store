// The shop's own colours, in one place, so an email rendered on the backend
// and a screen rendered in the admin can never drift apart.
//
// Emails cannot read a CSS variable or a Tailwind class — every colour has to
// be written inline into the markup (see backend/src/lib/email), which is
// exactly why these live here as plain hex strings rather than as theme
// tokens.
export const BRAND_COLORS = {
  /** Organza teal — headers, the action button, links. */
  teal: "#235C63",
  /** A darker teal for text that has to stay legible on a light ground. */
  tealDark: "#17444A",
  /** Organza light green — panels, borders, the button's soft surround. */
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

/** Shop-facing name, used where an email has to sign itself. */
export const BRAND_NAME = {
  ar: "أورجانزا",
  en: "Organza",
  he: "אורגנזה",
} as const;
