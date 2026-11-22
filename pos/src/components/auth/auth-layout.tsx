import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Typography } from "@store/ui";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { fetchBranding } from "@/lib/branding";
import { storeDisplayName } from "@/lib/store-name";
import { resolveImageUrl } from "@/lib/image-fallback";
import { LOGO_ICON_SIZE, pwaIconPath } from "@/constants/pwa";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

// Signed-out screens: one card, brand beside the form from `desk` so a landscape tablet never scrolls.
export async function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const [tApp, storeName, branding] = await Promise.all([getTranslations("app"), storeDisplayName(), fetchBranding()]);
  const logo = branding?.logoUrl ? resolveImageUrl(branding.logoUrl) : pwaIconPath(LOGO_ICON_SIZE);

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-canvas p-4 tab:p-6"
      data-test-selector="pos-auth-screen"
    >
      <div className="grid w-full max-w-md overflow-hidden rounded-card border border-line bg-surface shadow-card desk:max-w-4xl desk:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section
          className="flex flex-col gap-4 bg-linear-125 from-primary-900 via-primary-700 to-primary-500 p-5 text-ink-inverse desk:justify-between desk:gap-8 desk:p-8"
          data-test-selector="pos-auth-brand"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-surface p-1.5 shadow-card desk:size-16">
              {/* eslint-disable-next-line @next/next/no-img-element -- an already-optimised WebP served by the API */}
              <img src={logo} alt="" className="size-full object-contain" data-test-selector="shop-logo" />
            </span>
            <LanguageSwitcher variant="pill" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Typography as="p" variant="h1" weight="bold" className="text-ink-inverse desk:text-[2rem]">
                {storeName}
              </Typography>
              <EnvironmentBadge />
            </div>
            <Typography as="p" variant="body" className="text-primary-100">
              {tApp("tagline")}
            </Typography>
          </div>
        </section>

        <section className="flex flex-col gap-5 p-5 desk:justify-center desk:p-8">
          <div className="flex flex-col gap-1">
            <Typography variant="h1">{title}</Typography>
            <Typography variant="body" tone="muted">
              {subtitle}
            </Typography>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
