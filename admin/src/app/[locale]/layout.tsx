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
  APPLE_SPLASH_SCREENS,
  PWA_APPLE_ICON_SIZE,
  PWA_DESCRIPTION,
  PWA_FAVICON_PNG_SIZES,
  PWA_MANIFEST_PATH,
  PWA_NAME,
  PWA_SHORT_NAME,
  PWA_THEME_COLOR,
  appleSplashImagePath,
  appleSplashMediaQuery,
  brandIconPath,
} from "@/constants/pwa";
import { AppProviders } from "@/components/providers/app-providers";
import { BootFailure } from "@/components/pwa/boot-failure";
import { BootSplash } from "@/components/pwa/boot-splash";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import "../globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic"] });
const notoSansHebrew = Noto_Sans_Hebrew({
  variable: "--font-noto-hebrew",
  subsets: ["hebrew"],
});

export const metadata: Metadata = {
  applicationName: PWA_NAME,
  title: PWA_NAME,
  description: PWA_DESCRIPTION,
  manifest: PWA_MANIFEST_PATH,
  icons: {
    // Both resolve to the shop's uploaded favicon when there is one, else this environment's built-in icon.
    icon: PWA_FAVICON_PNG_SIZES.map((size) => ({
      url: brandIconPath(size),
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
    apple: [
      {
        url: brandIconPath(PWA_APPLE_ICON_SIZE),
        sizes: `${PWA_APPLE_ICON_SIZE}x${PWA_APPLE_ICON_SIZE}`,
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    // Shown under the iPhone home-screen icon; iOS truncates hard.
    title: PWA_SHORT_NAME,
    // Translucent would let the page scroll under the clock and battery.
    statusBarStyle: "default",
    // Without launch images an installed app opens on a blank white screen.
    startupImage: APPLE_SPLASH_SCREENS.map((screen) => ({
      url: appleSplashImagePath(screen),
      media: appleSplashMediaQuery(screen),
    })),
  },
  other: {
    // Next emits only mobile-web-app-capable, which iOS before Safari 17.4 doesn't understand.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        <BootFailure />
        <NextIntlClientProvider>
          <AppProviders>
            <BootSplash />
            {children}
          </AppProviders>
          <ServiceWorkerRegistrar />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
