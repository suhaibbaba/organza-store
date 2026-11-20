import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EnvironmentBadge } from "@/components/layout/environment-badge";

interface AuthPageFrameProps {
  title: string;
  subtitle: string;
  // Which stack is being signed into, before the password is typed — these
  // screens have no top bar to carry the chip.
  showEnvironment?: boolean;
  children: ReactNode;
}

// The page around a signed-out form: the language, the shop's name, and the
// card. One frame for both, so they cannot drift apart again.
//
// Stacked on a phone and on anything tall. On a short, wide window
// (`short-wide`, globals.css) the stack is taller than the screen — on the
// shop's 10" Windows tablet "forgot your password?" sat below the fold of a
// page nobody expects to scroll — so there the name and the language stand
// BESIDE the card instead of above it.
export async function AuthPageFrame({ title, subtitle, showEnvironment = false, children }: AuthPageFrameProps) {
  const tApp = await getTranslations("app");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 short-wide:flex-row short-wide:gap-12 short-wide:py-2">
      <div className="flex flex-col items-center gap-6">
        <LanguageSwitcher />

        <div>
          <div className="mb-1 flex items-center justify-center gap-2">
            <p className="text-2xl font-semibold text-primary">{tApp("name")}</p>
            {showEnvironment && <EnvironmentBadge />}
          </div>
          <p className="text-center text-sm text-muted-foreground">{tApp("tagline")}</p>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
