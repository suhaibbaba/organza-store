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
  PWA_FAVICON_PATH,
  PWA_FAVICON_PNG_SIZES,
  PWA_MANIFEST_PATH,
  PWA_NAME,
  PWA_SHORT_NAME,
  PWA_THEME_COLOR,
  appleSplashImagePath,
  appleSplashMediaQuery,
  pwaIconPath,
} from "@/constants/pwa";
import { AppProviders } from "@/components/providers/app-providers";
import { BootFailure } from "@/components/pwa/boot-failure";
import { NativeGestureGuard } from "@/components/pwa/native-gesture-guard";
import { BootSplash } from "@/components/pwa/boot-splash";
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
    // The tab. Both entries point inside app_icon/<environment>/, so a
    // sandbox tab is amber-banded even before anything on the page has
    // rendered — the .ico for whatever still insists on one, the PNG for
    // everything that can pick by size (see PWA_FAVICON_PNG_SIZES).
    icon: [
      { url: PWA_FAVICON_PATH, sizes: "any", type: "image/x-icon" },
      ...PWA_FAVICON_PNG_SIZES.map((size) => ({
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
    // The launch images, one <link rel="apple-touch-startup-image"> per
    // device. Without these an installed app opens on a blank white screen
    // while iOS gets the web view up; with them it opens on the brand. The
    // list and both derived strings live in constants/pwa.ts.
    startupImage: APPLE_SPLASH_SCREENS.map((screen) => ({
      url: appleSplashImagePath(screen),
      media: appleSplashMediaQuery(screen),
    })),
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
//
// maximumScale/userScalable turn page zoom OFF. This is a till: the app is
// held in one hand over a counter, and a pinch nobody meant to make leaves
// the screen sitting askew at 1.4× in the middle of a sale, with a customer
// waiting and nobody free to pinch it back. Two things make that decision
// binding rather than advisory — `touch-action: manipulation` in globals.css,
// which removes double-tap-to-zoom without touching taps, and the gesture
// guards in components/pwa/native-gesture-guard.tsx, because iOS has ignored
// user-scalable=no since iOS 10. See that file for what holds where.
//
// Nothing may now depend on zooming: every label has to be legible and every
// control tappable at 1×, which is what the 16px form fields and the 44px
// minimum touch target are for.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        {/* Before the providers, and outside them: this is the screen for the
            case where none of the app's own JavaScript ever runs, so it must
            not be downstream of anything the bundle has to set up. It is a
            server component and its watchdog is inline ES5 — the first script
            in the document, and the only one that is certain to execute. */}
        <BootFailure />
        {/* Outside the providers, like the watchdog above: cancelling a pinch
            is not a feature of any one screen, and it has to be listening
            from the first frame — including on the login screen, which is
            not inside the app shell. */}
        <NativeGestureGuard />
        <NextIntlClientProvider>
          <AppProviders>
            {/* First thing in the document, and inside the session provider
                it watches: it holds the brand on screen from the frame the
                phone's launch image disappears until the app knows who is
                signed in. */}
            <BootSplash />
            {children}
          </AppProviders>
          {/* Inside the intl provider: the registrar no longer renders
              nothing — it puts the "a new version is ready" prompt on screen,
              and that wording goes through t() like all the rest. */}
          <ServiceWorkerRegistrar />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
