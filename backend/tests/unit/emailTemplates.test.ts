import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "@store/shared/constants/languages";
import { PASSWORD_TOKEN_PURPOSES, PASSWORD_TOKEN_TTL_HOURS } from "@store/shared/constants/passwordSetup";
import { BRAND_COLORS } from "@store/shared/constants/brand";
import { EMAIL_LOGO_PATH } from "@/constants/email";
import { renderPasswordSetupEmail } from "@/lib/email/templates/passwordSetup";
import type { SupportedLanguage } from "@/types/common";

// An email can't be fixed once sent and renders in clients nobody here can open, so its rules are asserted.

const ADMIN_URL = "https://admin.example.com";
const STORE_NAME = "متجر التجربة";
const TOKEN = "test-token-abc123";

function render(language: SupportedLanguage, purpose: (typeof PASSWORD_TOKEN_PURPOSES)[number]) {
  return renderPasswordSetupEmail({
    language,
    name: "Rawand",
    storeName: STORE_NAME,
    token: TOKEN,
    purpose,
    adminUrl: ADMIN_URL,
  });
}

describe("Password setup email", () => {
  describe("every language, every purpose", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const purpose of PASSWORD_TOKEN_PURPOSES) {
        it(`renders ${purpose} in ${language} with a subject, HTML and plain text`, () => {
          const email = render(language, purpose);

          expect(email.subject.trim().length).toBeGreaterThan(0);
          expect(email.html).toContain("<html");
          // Without a text part a transactional mail reads as bulk to spam filters.
          expect(email.text.trim().length).toBeGreaterThan(0);
          // The i18n fallback renders a missing key as itself, so none may appear.
          expect(email.html).not.toContain("passwordSet.");
          expect(email.html).not.toContain("passwordReset.");
          expect(email.html).not.toContain("common.");
          expect(email.html).not.toContain("{name}");
          expect(email.html).not.toContain("{hours}");
          expect(email.html).not.toContain("{storeName}");
          // The shop's name comes from Settings, in the subject and in the signature.
          expect(email.subject).toContain(STORE_NAME);
          expect(email.text).toContain(STORE_NAME);
        });
      }
    }
  });

  describe("the link", () => {
    it("points at the admin app, carries the token, and is in the reader's own language", () => {
      const email = render("he", "RESET");
      expect(email.html).toContain(`${ADMIN_URL}/he/set-password?token=${TOKEN}`);
    });

    it("appears as a raw, copyable URL as well as a button", () => {
      const email = render("ar", "SET");
      // The button may be eaten by a client; the raw URL is what they can paste.
      const occurrences = email.html.split(`${ADMIN_URL}/ar/set-password?token=${TOKEN}`).length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(3); // href, href, and the visible text
      expect(email.text).toContain(`${ADMIN_URL}/ar/set-password?token=${TOKEN}`);
    });

    it("says how long it lasts, per purpose", () => {
      expect(render("en", "SET").html).toContain(String(PASSWORD_TOKEN_TTL_HOURS.SET));
      expect(render("en", "RESET").html).toContain(String(PASSWORD_TOKEN_TTL_HOURS.RESET));
    });
  });

  describe("Arabic and Hebrew read right to left", () => {
    for (const language of ["ar", "he"] as const) {
      it(`sets dir="rtl" on ${language}`, () => {
        const html = render(language, "SET").html;
        expect(html).toContain(`dir="rtl"`);
        expect(html).toContain(`lang="${language}"`);
        // Cells align to the start edge, so a client ignoring `dir` still lays out right.
        expect(html).toContain("text-align:right;");
      });
    }

    it("keeps English left to right", () => {
      const html = render("en", "SET").html;
      expect(html).toContain(`dir="ltr"`);
      expect(html).toContain("text-align:left;");
    });

    it("keeps the URL itself left to right even inside an RTL email", () => {
      // A URL is not Arabic; letting it mirror turns it into nonsense.
      expect(render("ar", "SET").html).toContain(`<p dir="ltr"`);
    });
  });

  describe("email HTML, not web HTML", () => {
    const html = render("ar", "SET").html;

    it("lays out with tables and inline styles", () => {
      expect(html).toContain("<table");
      expect(html).toContain('role="presentation"');
      expect(html).toContain("style=");
    });

    it("uses nothing Outlook cannot render", () => {
      // No flex, grid, CSS variables or webfonts: Outlook ignores or mangles them.
      expect(html).not.toMatch(/display\s*:\s*(flex|grid)/);
      expect(html).not.toContain("var(--");
      expect(html).not.toContain("@font-face");
      expect(html).not.toContain("@import");
    });

    it("carries the email palette", () => {
      expect(html).toContain(BRAND_COLORS.teal);
      expect(html).toContain(BRAND_COLORS.light);
    });

    it("shows the logo, with the shop's name in text beside it for clients with images off", () => {
      // Through the constant, so this and the mail cannot disagree when the icons move.
      expect(html).toContain(`${ADMIN_URL}${EMAIL_LOGO_PATH}`);
      expect(EMAIL_LOGO_PATH).toMatch(/^\/app_icon\/(sandbox|production)\/icon-\d+\.png$/);
      expect(html).toContain(`alt="${STORE_NAME}"`);
      expect(html).toContain(`>${STORE_NAME}<`);
    });

    it("carries a preheader for the inbox list", () => {
      expect(html).toContain("display:none;font-size:1px");
    });

    it("is responsive on a phone", () => {
      expect(html).toContain("@media only screen and (max-width: 620px)");
      expect(html).toContain("max-width:100%");
    });
  });

  describe("deliverability", () => {
    it("carries no tracking pixel and no rewritten links", () => {
      const html = render("en", "RESET").html;
      // One image only: a beacon or tracking redirect makes a transactional mail look like marketing.
      expect(html.match(/<img/g)).toHaveLength(1);
      expect(html).not.toMatch(/width="1"\s+height="1"/);
      for (const href of html.match(/href="([^"]*)"/g) ?? []) {
        expect(href).toContain(ADMIN_URL);
      }
    });
  });
});
