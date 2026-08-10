import { appIconPath } from "@shared/constants/appEnv";
import { APP_ENV } from "@/lib/appEnv";

// Transactional email — provider, addresses, and the numbers the templates
// are laid out against.
//
// Everything here is read from the environment at call time (see
// lib/email/config.ts) rather than baked in, so the sandbox and the live shop
// differ by a .env line and nothing else.

/** Resend's REST endpoint. The only place the provider's name appears in a URL. */
export const RESEND_API_URL = "https://api.resend.com/emails";

/** How long we wait on the provider before giving up. A slow mail API must never hold a request open. */
export const EMAIL_SEND_TIMEOUT_MS = 10_000;

/** Fallback From address if EMAIL_FROM is unset. The domain is the verified one. */
export const DEFAULT_EMAIL_FROM = "noreply@organza-moda.com";

/**
 * Transports the email service knows about.
 *  - `resend`  : the real provider.
 *  - `console` : renders and logs the message instead of sending it. What a
 *                deployment with no API key falls back to, so a missing key
 *                degrades to "not delivered" rather than to "crashed".
 */
export const EMAIL_TRANSPORTS = ["resend", "console"] as const;

// --- template layout ---------------------------------------------------
// Emails are laid out with tables and inline styles (Outlook renders neither
// flexbox nor a <style> block reliably), so every dimension is a number
// written into an attribute. They live here rather than inline in the markup
// for the same reason every other magic number in this repo does.

/** Card width on a desktop client; below this the card simply fills the screen. */
export const EMAIL_CONTENT_WIDTH_PX = 600;
export const EMAIL_LOGO_HEIGHT_PX = 44;
/** Which square PNG the logo above is drawn from — retina-sharp at that height. */
export const EMAIL_LOGO_ICON_SIZE = 192;
export const EMAIL_BUTTON_RADIUS_PX = 8;
export const EMAIL_CARD_RADIUS_PX = 12;

/**
 * Arabic and Hebrew need a font stack that actually ships with the mail
 * clients people read on — no webfonts, which Gmail and Outlook strip.
 * "Segoe UI" covers Windows/Outlook, Tahoma is the classic Arabic-safe
 * fallback, and Arial/sans-serif closes it out.
 */
export const EMAIL_FONT_STACK =
  "'Segoe UI', Tahoma, Arial, 'Helvetica Neue', Helvetica, sans-serif";

/**
 * The shop's mark, served by the admin app out of its own `public/` folder.
 * A remote URL rather than an inline `data:` image on purpose: Gmail strips
 * data URIs, and an attached image turns a password mail into something with
 * an attachment on it.
 *
 * Built from this API's own APP_ENV, so a "set your password" mail sent by the
 * sandbox carries the amber SBX mark and one from the live shop carries the
 * plain one — the same distinction the home-screen tiles make, in the inbox
 * where the link is actually clicked. The folder layout comes from
 * @shared/constants/appEnv rather than being spelled out here: the file it
 * points at lives in another project, and nothing would report a 404 on it —
 * the mail would simply arrive with a hole where the logo was.
 */
export const EMAIL_LOGO_PATH = appIconPath(APP_ENV, EMAIL_LOGO_ICON_SIZE);

/** Where the preview command writes its rendered files. */
export const EMAIL_PREVIEW_DIR = "tmp/email-preview";
