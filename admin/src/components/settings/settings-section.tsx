"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Section } from "@store/ui";
import { SETTINGS_SECTIONS, type SettingsSectionName } from "@/constants/settings";

export function SettingsSection({
  name,
  forceOpen,
  children,
}: {
  name: SettingsSectionName;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations(`settings.sections.${name}`);
  const { icon, tone } = SETTINGS_SECTIONS[name];
  return (
    <Section
      data-testid={`settings-${name}`}
      title={t("title")}
      description={t("description")}
      icon={icon}
      tone={tone}
      collapsible
      forceOpen={forceOpen}
    >
      {children}
    </Section>
  );
}
