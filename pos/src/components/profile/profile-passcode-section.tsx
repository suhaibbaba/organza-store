"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Modal } from "@store/ui";
import { ProfileSection } from "@/components/profile/profile-section";
import { PasscodeForm } from "@/components/auth/passcode-form";

export function ProfilePasscodeSection() {
  const t = useTranslations("passcode");
  const [open, setOpen] = useState(false);

  return (
    <ProfileSection name="passcode">
      <Button
        variant="secondary"
        className="self-start"
        data-testid="pos-passcode-change-open"
        icon={<Icon name="key" className="size-4" />}
        onClick={() => setOpen(true)}
      >
        {t("change")}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        data-testid="pos-passcode-change-modal"
        title="passcode.changeTitle"
        description="passcode.changeDescription"
      >
        {open && <PasscodeForm onSaved={() => setOpen(false)} />}
      </Modal>
    </ProfileSection>
  );
}
