import { appIconPath } from "@store/shared/constants/appEnv";
import { APP_ENV } from "@/lib/appEnv";

// Transactional email settings, read from the environment at call time so stacks differ by .env only.

/** Resend's REST endpoint. The only place the provider's name appears in a URL. */
export const RESEND_API_URL = "https://api.resend.com/emails";

/** How long we wait on the provider before giving up. A slow mail API must never hold a request open. */
export const EMAIL_SEND_TIMEOUT_MS = 10_000;

/** Development fallback only: production sets EMAIL_FROM to an address on the shop's verified domain. */
export const DEFAULT_EMAIL_FROM = "noreply@example.com";

/** `resend` sends; `console` logs instead — the fallback without an API key, so a missing key means undelivered, not crashed. */
export const EMAIL_TRANSPORTS = ["resend", "console"] as const;

// Template layout numbers: emails use tables and inline attributes, since Outlook handles neither flexbox nor <style>.

/** Card width on a desktop client; below this the card simply fills the screen. */
export const EMAIL_CONTENT_WIDTH_PX = 600;
export const EMAIL_LOGO_HEIGHT_PX = 44;
/** Which square PNG the logo above is drawn from — retina-sharp at that height. */
export const EMAIL_LOGO_ICON_SIZE = 192;
export const EMAIL_BUTTON_RADIUS_PX = 8;
export const EMAIL_CARD_RADIUS_PX = 12;

/** A font stack mail clients ship (no webfonts, which Gmail and Outlook strip) that renders Arabic and Hebrew. */
export const EMAIL_FONT_STACK = "'Segoe UI', Tahoma, Arial, 'Helvetica Neue', Helvetica, sans-serif";

/** The shop's mark served by the admin's public/ (Gmail strips data URIs), chosen by this API's APP_ENV. */
export const EMAIL_LOGO_PATH = appIconPath(APP_ENV, EMAIL_LOGO_ICON_SIZE);

/** Where the preview command writes its rendered files. */
export const EMAIL_PREVIEW_DIR = "tmp/email-preview";
