import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Cairo } from "next/font/google";
import { Noto_Sans_Hebrew } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { getTextDirection } from "@/constants/locale";
import { AppProviders } from "@/components/providers/app-providers";
import "../globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic"] });
const notoSansHebrew = Noto_Sans_Hebrew({ variable: "--font-noto-hebrew", subsets: ["hebrew"] });

export const metadata: Metadata = {
  title: "Organza Store — Admin",
  description: "Organza Store admin dashboard",
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
      </body>
    </html>
  );
}
