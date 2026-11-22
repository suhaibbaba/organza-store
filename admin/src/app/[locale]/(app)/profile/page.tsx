"use client";

import { useTranslations } from "next-intl";
import { Alert, Button, Skeleton } from "@store/ui";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileDetailsForm } from "@/components/profile/profile-details-form";
import { ProfileDevicesSection } from "@/components/profile/profile-devices-section";
import { ProfilePasswordSection } from "@/components/profile/profile-password-section";
import { ProfilePasskeysSection } from "@/components/profile/profile-passkeys-section";
import { ProfileLanguageSection } from "@/components/profile/profile-language-section";
import { ProfileNotificationsSection } from "@/components/profile/profile-notifications-section";
import { useProfileQuery } from "@/hooks/use-profile";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { NOTIFICATION_RECIPIENT_ROLES } from "@/constants/profile";

// Every role's own account; the API only ever answers for the signed-in person, so there is no permission to guard.
export default function ProfilePage() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const { user } = useSession();
  const { data: profile, isLoading, isError, error, refetch } = useProfileQuery();
  const receivesNotifications = Boolean(user && NOTIFICATION_RECIPIENT_ROLES.includes(user.role));

  return (
    <PageContainer>
      <PageHeader name="profile" title={t("title")} description={t("subtitle")} />

      {isLoading ? (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-36 rounded-card" />
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Skeleton className="h-72 rounded-card" />
            <Skeleton className="h-48 rounded-card" />
          </div>
        </div>
      ) : isError || !profile ? (
        <Alert
          tone="danger"
          data-testid="alert-destructive"
          action={
            <Button type="button" variant="secondary" onClick={() => void refetch()}>
              {tCommon("retry")}
            </Button>
          }
        >
          {translateError(error instanceof ApiError ? error.code : "error.internal")}
        </Alert>
      ) : (
        <div className="flex flex-col gap-5">
          <ProfileHeader profile={profile} />
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-5">
              <ProfileDetailsForm profile={profile} />
              <ProfileDevicesSection />
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <ProfilePasswordSection />
              <ProfilePasskeysSection />
              <ProfileLanguageSection />
              {receivesNotifications && <ProfileNotificationsSection />}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
