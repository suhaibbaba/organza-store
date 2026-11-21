import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EnvironmentBadge } from "@/components/layout/environment-badge";

interface AuthPageProps {
  appName: string;
  title: string;
  subtitle: string;
  // Rendered as `auth-<name>`.
  name: string;
  children: ReactNode;
}

// The signed-out frame (clinic auth card): language on top, the shop and its sandbox chip, then the card. No top bar here to carry the chip.
export function AuthPage({ appName, title, subtitle, name, children }: AuthPageProps) {
  return (
    <main
      className="flex min-h-dvh flex-col bg-canvas px-4 pb-[calc(var(--safe-bottom)+1.5rem)] pt-[calc(var(--safe-top)+1.5rem)] sm:px-8"
      data-test-selector={`auth-${name}`}
    >
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="flex w-full max-w-sm flex-col gap-6 rounded-card border border-line bg-surface p-7 shadow-card">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-heading font-bold text-primary-700">{appName}</span>
              <EnvironmentBadge />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-section font-semibold text-ink">{title}</h1>
              <p className="text-label text-ink-muted">{subtitle}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
