"use client";

import { useTranslations } from "next-intl";
import { Spinner, Switch } from "@store/ui";
import type { PermissionAction } from "@store/shared/types/permission";
import type { Role } from "@store/shared/types/role";
import { testSelectorFor } from "@store/shared/lib/testSelector";

// Only the grant in flight shows a spinner, so the reader can tell which tap it was.
export function PermissionToggle({
  role,
  action,
  actionLabel,
  granted,
  busy,
  onChange,
}: {
  role: Role;
  action: PermissionAction;
  actionLabel: string;
  granted: boolean;
  busy: boolean;
  onChange: (granted: boolean) => void;
}) {
  const t = useTranslations("permissions");

  if (busy) {
    return (
      <span className="inline-flex h-6 w-11 items-center justify-center">
        <Spinner className="size-5" label={t("saving")} />
      </span>
    );
  }

  return (
    <Switch
      checked={granted}
      onCheckedChange={onChange}
      label={t("toggleLabel", { action: actionLabel, role: t(`role.${role}`) })}
      hideLabel
      data-testid={testSelectorFor("permission-toggle", `${role}-${action}`)}
    />
  );
}
