"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Section } from "@store/ui";
import { PROFILE_SECTIONS } from "@/constants/profile";

export type ProfileSectionName = keyof typeof PROFILE_SECTIONS;

export function ProfileSection({ name, children }: { name: ProfileSectionName; children: ReactNode }) {
  const t = useTranslations(`profile.sections.${name}`);
  const { icon, tone } = PROFILE_SECTIONS[name];
  return (
    <Section data-testid={`pos-profile-${name}`} title={t("title")} description={t("description")} icon={icon} tone={tone}>
      {children}
    </Section>
  );
}
