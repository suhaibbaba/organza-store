"use client";

import { useLocale, useTranslations } from "next-intl";
import { Avatar, Typography } from "@store/ui";
import type { Profile } from "@store/shared/types/profile";
import { RoleBadge } from "@/components/users/role-badge";
import { PROFILE_AVATAR_SIZE } from "@/constants/profile";
import { formatDate } from "@/lib/format";

export function ProfileHeader({ profile }: { profile: Profile }) {
  const t = useTranslations("profile.header");
  const locale = useLocale();

  return (
    <header data-test-selector="profile-header" className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={profile.name} tintKey={profile.id} size={PROFILE_AVATAR_SIZE} />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Typography variant="h2" as="p" className="max-w-full truncate text-primary-900">
            {profile.name}
          </Typography>
          <RoleBadge role={profile.role} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-3">
        <div className="flex min-w-0 flex-col items-start">
          <dt className="text-value text-ink-muted">{t("email")}</dt>
          <dd className="mt-0.5 max-w-full truncate text-value text-ink" dir="ltr">
            {profile.email}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col items-start">
          <dt className="text-value text-ink-muted">{t("phone")}</dt>
          <dd className="mt-0.5 text-value tabular-nums text-ink" dir="ltr">
            {profile.phone}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col items-start">
          <dt className="text-value text-ink-muted">{t("memberSince")}</dt>
          <dd className="mt-0.5 text-value text-ink">{formatDate(profile.createdAt, locale)}</dd>
        </div>
      </dl>
    </header>
  );
}
