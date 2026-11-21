"use client";

import { useLocale, useTranslations } from "next-intl";
import { SegmentedControl } from "@store/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { LOCALE_LABELS } from "@/constants/locale";
import { ProfileSection } from "@/components/profile/profile-section";
import { useRememberLocale } from "@/hooks/use-profile";

// Applied at once: the page re-renders in the chosen language, and the account remembers it for the next sign-in.
export function ProfileLanguageSection() {
  const t = useTranslations("profile.language");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const remember = useRememberLocale();

  function choose(next: AppLocale) {
    remember(next);
    router.replace(pathname, { locale: next });
  }

  return (
    <ProfileSection name="language">
      <SegmentedControl
        data-testid="pos-profile-language"
        label={t("label")}
        value={locale}
        options={routing.locales.map((value) => ({ value, label: LOCALE_LABELS[value] }))}
        onChange={choose}
      />
    </ProfileSection>
  );
}
