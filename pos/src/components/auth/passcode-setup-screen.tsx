"use client";

import { useTranslations } from "next-intl";
import { Button, Typography } from "@store/ui";
import { ShopLogo } from "@/components/brand/shop-logo";
import { PasscodeForm } from "@/components/auth/passcode-form";
import { useSession } from "@/components/providers/session-provider";

// Right after a password sign-in on a tablet: the passcode is what reopens the till after it locks.
export function PasscodeSetupScreen() {
  const t = useTranslations("passcode");
  const { logout } = useSession();

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4 py-8"
      data-test-selector="pos-passcode-setup"
    >
      <div className="flex w-full max-w-md flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-card">
        <ShopLogo className="h-12 w-auto self-start" />
        <div className="flex flex-col gap-1">
          <Typography variant="h1">{t("setupTitle")}</Typography>
          <Typography variant="body" tone="muted">
            {t("setupDescription")}
          </Typography>
        </div>
        <PasscodeForm onSaved={() => undefined} />
        <Button
          variant="quiet"
          onClick={() => void logout()}
          data-testid="pos-passcode-setup-logout"
          className="self-start"
        >
          {t("signOut")}
        </Button>
      </div>
    </main>
  );
}
