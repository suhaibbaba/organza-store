"use client";

import type { ReactNode } from "react";
import { useLocale } from "next-intl";
import { ToastProvider } from "@store/ui";
import { UiProvider } from "@store/ui/theme";
import { organzaTheme } from "@store/ui/themes/organza";
import { getTextDirection } from "@/constants/locale";
import type { AppLocale } from "@/i18n/routing";
import { QueryProvider } from "@/components/providers/query-provider";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { SessionProvider } from "@/components/providers/session-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  const locale = useLocale() as AppLocale;

  return (
    <UiProvider
      theme={organzaTheme}
      direction={getTextDirection(locale)}
      lang={locale}
    >
      <ToastProvider>
        <QueryProvider>
          {/* Inside SessionProvider: the rules are per shop, not per person, but
          there is nothing to load for somebody who is not signed in. */}
          <SessionProvider>
            <PermissionsProvider>{children}</PermissionsProvider>
          </SessionProvider>
        </QueryProvider>
      </ToastProvider>
    </UiProvider>
  );
}
