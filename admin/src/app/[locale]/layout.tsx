import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Cairo } from "next/font/google";
import { Noto_Sans_Hebrew } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { getTextDirection } from "@/constants/locale";
import {
  PWA_APPLE_ICON_SIZE,
  PWA_DESCRIPTION,
  PWA_FAVICON_PATH,
  PWA_ICON_SIZES,
  PWA_MANIFEST_PATH,
  PWA_NAME,
  PWA_SHORT_NAME,
  PWA_THEME_COLOR,
  pwaIconPath,
} from "@/constants/pwa";
import { AppProviders } from "@/components/providers/app-providers";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import "../globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic"] });
const notoSansHebrew = Noto_Sans_Hebrew({ variable: "--font-noto-hebrew", subsets: ["hebrew"] });

export const metadata: Metadata = {
  applicationName: PWA_NAME,
  title: "Organza Store — Admin",
  description: PWA_DESCRIPTION,
  manifest: PWA_MANIFEST_PATH,
  icons: {
    icon: [
      { url: PWA_FAVICON_PATH, sizes: "any", type: "image/x-icon" },
      ...PWA_ICON_SIZES.map((size) => ({
        url: pwaIconPath(size),
        sizes: `${size}x${size}`,
        type: "image/png",
      })),
    ],
    shortcut: PWA_FAVICON_PATH,
    // iOS ignores the manifest's icons entirely and uses this one for the
    // home screen, so it has to be declared here as well.
    apple: [
      {
        url: pwaIconPath(PWA_APPLE_ICON_SIZE),
        sizes: `${PWA_APPLE_ICON_SIZE}x${PWA_APPLE_ICON_SIZE}`,
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    // What appears under the icon on an iPhone home screen — short, because
    // iOS truncates hard.
    title: PWA_SHORT_NAME,
    // "default", not "black-translucent": translucent would let the page
    // scroll up underneath the clock and battery.
    statusBarStyle: "default",
  },
  other: {
    // For `capable: true` Next now emits only the modern
    // `mobile-web-app-capable`, which iOS didn't understand before Safari
    // 17.4. Older iPhones in the shop still read this one to launch without
    // browser chrome, and a newer one just ignores it.
    "apple-mobile-web-app-capable": "yes",
  },
};

// viewport-fit=cover is required for env(safe-area-inset-*) to resolve to
// anything other than 0 — without it, fixed bars stay padded for nothing
// and get covered by the iOS home indicator on notched iPhones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Tints the Android status bar once installed, and the address bar before
  // that. Matches the manifest's theme_color.
  themeColor: PWA_THEME_COLOR,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale as AppLocale);

  return (
    <html
      lang={locale}
      dir={getTextDirection(locale as AppLocale)}
      className={`${geist.variable} ${cairo.variable} ${notoSansHebrew.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
