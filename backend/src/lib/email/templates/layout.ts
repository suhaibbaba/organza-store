import { BRAND_COLORS } from "@shared/constants/brand";
import {
  EMAIL_BUTTON_RADIUS_PX,
  EMAIL_CARD_RADIUS_PX,
  EMAIL_CONTENT_WIDTH_PX,
  EMAIL_FONT_STACK,
  EMAIL_LOGO_HEIGHT_PX,
  EMAIL_LOGO_PATH,
} from "@/constants/email";
import { isRtl, t } from "@/lib/email/i18n";
import type { SupportedLanguage } from "@/types/common";
import type { EmailLayoutInput } from "@/types/email";

// The branded shell every email is poured into.
//
// Email HTML is not web HTML and this file is where that is dealt with once:
//   - tables for layout. Outlook renders flexbox and grid not at all, and
//     `div` widths unreliably; nested tables with explicit widths are what
//     twenty-year-old rendering engines agree on.
//   - every style inline. Gmail strips <head><style> on some clients and
//     Outlook.com rewrites class names, so a class is a style that may or may
//     not exist. The one <style> block below carries ONLY a mobile media
//     query — progressive enhancement, never anything the layout depends on.
//   - no webfonts, no background-image, no CSS variables, no border-radius
//     the layout relies on (Outlook squares the corners and that is fine).
//   - RTL for real: `dir` on the html element AND an explicit text-align on
//     every cell, because a client that ignores `dir` still honours the
//     attribute on the cell.
//   - no tracking pixel and no rewritten links, for the reason in
//     transports/resend.ts.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { escapeHtml };

export function renderLayout(input: EmailLayoutInput): string {
  const { language, preheader, heading, paragraphs, action, footNote } = input;
  const rtl = isRtl(language);
  const dir = rtl ? "rtl" : "ltr";
  const start = rtl ? "right" : "left";
  const brandName = t(language, "brand.name");
  const tagline = t(language, "brand.tagline");

  const paragraphHtml = paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:${BRAND_COLORS.text};text-align:${start};">${escapeHtml(
          text
        )}</p>`
    )
    .join("");

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${language}" dir="${dir}">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(heading)}</title>
<style type="text/css">
  /* Enhancement only — every width below also works without this block. */
  @media only screen and (max-width: 620px) {
    .organza-card { width: 100% !important; }
    .organza-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .organza-button { display: block !important; width: auto !important; }
  }
</style>
</head>
<body dir="${dir}" style="margin:0;padding:0;background-color:${BRAND_COLORS.background};font-family:${EMAIL_FONT_STACK};">
<!-- Preview text: what the inbox list shows next to the subject. Hidden in the
     body itself, then padded so the client does not pull the next line in. -->
<div style="display:none;font-size:1px;color:${BRAND_COLORS.background};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(
    preheader
  )}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_COLORS.background};">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table role="presentation" class="organza-card" width="${EMAIL_CONTENT_WIDTH_PX}" cellpadding="0" cellspacing="0" border="0" style="width:${EMAIL_CONTENT_WIDTH_PX}px;max-width:100%;background-color:${BRAND_COLORS.surface};border:1px solid ${BRAND_COLORS.border};border-radius:${EMAIL_CARD_RADIUS_PX}px;">

        <!-- Header: the mark, then the shop's name as text so a client with
             images off still shows who this is from. -->
        <tr>
          <td align="center" class="organza-pad" style="padding:28px 32px 20px 32px;background-color:${BRAND_COLORS.teal};border-radius:${EMAIL_CARD_RADIUS_PX}px ${EMAIL_CARD_RADIUS_PX}px 0 0;">
            <img src="${escapeHtml(input.logoUrl)}" width="${EMAIL_LOGO_HEIGHT_PX}" height="${EMAIL_LOGO_HEIGHT_PX}" alt="${escapeHtml(
              brandName
            )}" style="display:block;border:0;outline:none;text-decoration:none;height:${EMAIL_LOGO_HEIGHT_PX}px;width:${EMAIL_LOGO_HEIGHT_PX}px;margin:0 auto 10px auto;" />
            <div style="font-size:20px;font-weight:bold;color:#FFFFFF;line-height:1.4;">${escapeHtml(brandName)}</div>
            <div style="font-size:13px;color:${BRAND_COLORS.light};line-height:1.5;">${escapeHtml(tagline)}</div>
          </td>
        </tr>

        <tr>
          <td class="organza-pad" style="padding:32px;">
            <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.4;color:${BRAND_COLORS.tealDark};text-align:${start};">${escapeHtml(
              heading
            )}</h1>
            ${paragraphHtml}

            <!-- The one action. Bulletproof button: a table cell with the
                 background colour, so a client that drops the anchor's own
                 padding still draws a button. -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0;">
              <tr>
                <td align="center" bgcolor="${BRAND_COLORS.teal}" style="background-color:${BRAND_COLORS.teal};border-radius:${EMAIL_BUTTON_RADIUS_PX}px;">
                  <a class="organza-button" href="${escapeHtml(action.url)}" target="_blank" rel="noopener" style="display:inline-block;padding:16px 34px;font-family:${EMAIL_FONT_STACK};font-size:17px;font-weight:bold;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:${EMAIL_BUTTON_RADIUS_PX}px;">${escapeHtml(
                    action.label
                  )}</a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:${BRAND_COLORS.muted};text-align:${start};">${escapeHtml(
              action.fallbackIntro
            )}</p>
            <!-- The raw link, always. A button is a link somebody's client may
                 have eaten; this is the copy they can paste. Left-to-right and
                 word-broken even in an RTL mail, because a URL is not Arabic. -->
            <p dir="ltr" style="margin:0 0 20px 0;font-size:13px;line-height:1.6;color:${BRAND_COLORS.teal};word-break:break-all;text-align:left;">
              <a href="${escapeHtml(action.url)}" target="_blank" rel="noopener" style="color:${BRAND_COLORS.teal};text-decoration:underline;">${escapeHtml(
                action.url
              )}</a>
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_COLORS.light};border-radius:8px;">
              <tr>
                <td style="padding:14px 18px;font-size:14px;line-height:1.6;color:${BRAND_COLORS.tealDark};text-align:${start};">${escapeHtml(
                  action.note
                )}</td>
              </tr>
            </table>

            ${
              footNote
                ? `<p style="margin:20px 0 0 0;font-size:14px;line-height:1.6;color:${BRAND_COLORS.muted};text-align:${start};">${escapeHtml(
                    footNote
                  )}</p>`
                : ""
            }
          </td>
        </tr>

        <tr>
          <td class="organza-pad" style="padding:20px 32px 26px 32px;border-top:1px solid ${BRAND_COLORS.border};">
            <p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:${BRAND_COLORS.text};text-align:${start};">${escapeHtml(
              t(language, "common.signature")
            )}</p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND_COLORS.muted};text-align:${start};">${escapeHtml(
              t(language, "common.replyNote")
            )}</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * The plain-text alternative. Not a stripped-down courtesy copy — it is what
 * a text-only client, a screen reader in text mode, and every spam filter
 * actually reads, and a transactional mail without one is a transactional
 * mail in the junk folder.
 */
export function renderText(input: EmailLayoutInput): string {
  const { language, heading, paragraphs, action, footNote } = input;
  return [
    t(language, "brand.name"),
    "",
    heading,
    "",
    ...paragraphs,
    "",
    `${action.label}:`,
    action.url,
    "",
    action.note,
    ...(footNote ? ["", footNote] : []),
    "",
    t(language, "common.signature"),
    t(language, "common.replyNote"),
  ].join("\n");
}

/** Absolute URL of the mark, on whichever origin the admin app is served from. */
export function logoUrlFor(adminUrl: string): string {
  return `${adminUrl}${EMAIL_LOGO_PATH}`;
}
