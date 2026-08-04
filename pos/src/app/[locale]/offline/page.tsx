import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PWA_THEME_COLOR } from "@/constants/pwa";

/**
 * Last-resort screen when a page is opened with no connection and nothing
 * useful in the cache. The service worker precaches one of these per locale
 * (see public/sw.js), which is also why proxy.ts lets it through without a
 * session — a precached redirect to /login would be no fallback at all.
 *
 * Styled inline rather than with Tailwind on purpose: this page has to look
 * right on the one occasion the stylesheet itself didn't make it out of the
 * cache. Direction and font come from <html> in the layout, so it mirrors
 * correctly in Arabic and Hebrew without doing anything here.
 */
export default async function OfflinePage() {
  const t = await getTranslations("offline");
  const tCommon = await getTranslations("common");

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem 1.5rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.375rem", fontWeight: 600, margin: 0 }}>{t("title")}</h1>
      <p style={{ margin: 0, maxWidth: "28rem", lineHeight: 1.6, opacity: 0.75 }}>{t("message")}</p>

      <Link
        href="/"
        style={{
          // 44px min touch target (CLAUDE.md mobile rules).
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "2.75rem",
          padding: "0 1.5rem",
          borderRadius: "0.75rem",
          background: PWA_THEME_COLOR,
          color: "#fff",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {tCommon("retry")}
      </Link>
    </main>
  );
}
