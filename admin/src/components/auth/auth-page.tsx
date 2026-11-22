import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Typography } from "@store/ui";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { fetchBranding } from "@/lib/branding";
import { storeDisplayName } from "@/lib/store-name";
import { resolveImageUrl } from "@/lib/image-fallback";
import { LOGO_ICON_SIZE, pwaIconPath } from "@/constants/pwa";

interface AuthPageProps {
  title: string;
  subtitle: string;
  // Rendered as `auth-<name>`.
  name: string;
  children: ReactNode;
}

// Signed-out screens (as the POS): one card, logo and tagline beside the form from `lg`, a band above it below that.
export async function AuthPage({ title, subtitle, name, children }: AuthPageProps) {
  const [tApp, storeName, branding] = await Promise.all([
    getTranslations("app"),
    storeDisplayName(),
    fetchBranding(),
  ]);
  const logo = branding?.logoUrl ? resolveImageUrl(branding.logoUrl) : pwaIconPath(LOGO_ICON_SIZE);

  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-canvas px-4 pb-[calc(var(--safe-bottom)+1rem)] pt-[calc(var(--safe-top)+1rem)] sm:px-6"
      data-test-selector={`auth-${name}`}
    >
      <div className="grid w-full max-w-md overflow-hidden rounded-card border border-line bg-surface shadow-card lg:max-w-4xl lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section
          className="flex flex-col gap-4 bg-linear-125 from-primary-900 via-primary-700 to-primary-500 p-5 text-ink-inverse lg:justify-between lg:gap-8 lg:p-8"
          data-test-selector="auth-brand"
        >
          <div className="flex items-center justify-between gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- an already-optimised WebP served by the API */}
            <img
              src={logo}
              alt={storeName}
              className="size-12 shrink-0 object-contain lg:size-16"
              data-test-selector="shop-logo"
            />
            <LanguageSwitcher variant="pill" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Typography as="p" variant="h2" weight="semibold" className="text-ink-inverse">
              {tApp("tagline")}
            </Typography>
            <EnvironmentBadge />
          </div>
        </section>

        <section className="flex flex-col gap-5 p-5 lg:justify-center lg:p-8">
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
