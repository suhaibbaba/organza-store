import type { JSX } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Button } from "@ui/components/button";
import { Icon } from "@ui/components/icon";
import { STICKY_PRIMARY_CLASS, STICKY_SECONDARY_CLASS, StickyActions } from "@ui/components/sticky-actions";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface SaveBarProps extends TestIdProps {
  readonly visible: boolean;
  readonly saving?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly message?: string | undefined;
  readonly className?: string | undefined;
}

export function SaveBar({
  visible,
  saving = false,
  invalid = false,
  onSave,
  onDiscard,
  message,
  className,
  "data-testid": testId,
}: SaveBarProps): JSX.Element {
  const { t } = useTranslation();
  const part = parts("save-bar", testId);

  return (
    <StickyActions
      data-testid={testId ?? "save-bar"}
      visible={visible}
      label={t("ui.common.unsavedChanges")}
      message={message ?? t("ui.common.unsavedChanges")}
      className={className}
    >
      <Button {...part("discard")} variant="quiet" className={STICKY_SECONDARY_CLASS} onClick={onDiscard}>
        {t("ui.common.discard")}
      </Button>
      <Button
        {...part("save")}
        icon={<Icon name="check" />}
        className={STICKY_PRIMARY_CLASS}
        isLoading={saving}
        {...(invalid && { "aria-disabled": true })}
        onClick={onSave}
      >
        {t("ui.common.save")}
      </Button>
    </StickyActions>
  );
}
