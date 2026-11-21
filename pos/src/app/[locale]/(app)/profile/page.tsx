"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Skeleton, Typography, buttonClassName } from "@store/ui";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { Link } from "@/i18n/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileDetailsForm } from "@/components/profile/profile-details-form";
import { ProfileDevicesSection } from "@/components/profile/profile-devices-section";
import { ProfilePasswordSection } from "@/components/profile/profile-password-section";
import { ProfileLanguageSection } from "@/components/profile/profile-language-section";
import { useProfileQuery } from "@/hooks/use-profile";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { POS_CONTROL_HEIGHT } from "@/constants/controls";
import { SELL_HREF } from "@/constants/profile";
import { cn } from "@/lib/utils";

// Every role's own account; the API only ever answers for the signed-in person, so there is no permission to guard.
export default function ProfilePage() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const { data: profile, isLoading, isError, error, refetch } = useProfileQuery();

  return (
    <>
      <TopBar />
      <main
        className={cn("mx-auto flex w-full max-w-5xl flex-col gap-5 px-3 py-5 tab:px-4 desk:px-5", POS_CONTROL_HEIGHT)}
      >
        <div className="flex flex-col items-start gap-3">
          <Link
            href={SELL_HREF}
            className={buttonClassName({ variant: "secondary" })}
            data-test-selector="pos-profile-back"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            {t("back")}
          </Link>
          <div>
            <Typography variant="h1" data-test-selector="pos-page-title-profile">
              {t("title")}
            </Typography>
            <Typography variant="body" tone="muted" className="mt-1">
              {t("subtitle")}
            </Typography>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-5">
            <Skeleton className="h-36 rounded-card" />
            <Skeleton className="h-72 rounded-card" />
          </div>
        ) : isError || !profile ? (
          <Alert
            tone="danger"
            data-testid="pos-profile-error"
            action={
              <Button type="button" variant="secondary" onClick={() => void refetch()}>
                {tCommon("retry")}
              </Button>
            }
          >
            {translateError(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        ) : (
          <>
            <ProfileHeader profile={profile} />
            <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex min-w-0 flex-col gap-5">
                <ProfileDetailsForm profile={profile} />
                <ProfileDevicesSection />
              </div>
              <div className="flex min-w-0 flex-col gap-5">
                <ProfilePasswordSection />
                <ProfileLanguageSection />
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
