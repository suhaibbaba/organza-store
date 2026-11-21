"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { Button } from "@store/ui";
import { ProfileSection } from "@/components/profile/profile-section";
import { PasswordChangeModal } from "@/components/profile/password-change-modal";

export function ProfilePasswordSection() {
  const t = useTranslations("profile.password");
  const [open, setOpen] = useState(false);

  return (
    <ProfileSection name="password">
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        data-test-selector="pos-password-change-open"
        icon={<KeyRound className="size-4" aria-hidden="true" />}
        onClick={() => setOpen(true)}
      >
        {t("open")}
      </Button>
      <PasswordChangeModal open={open} onOpenChange={setOpen} />
    </ProfileSection>
  );
}
