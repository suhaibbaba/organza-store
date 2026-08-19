"use client";

import { useTranslations } from "next-intl";
import type { PermissionAction } from "@organza/shared/types/permission";
import type { Role } from "@organza/shared/types/role";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";

/**
 * One grant, for one role.
 *
 * A Switch rather than a bare checkbox: it is the biggest on/off control in
 * this app's vocabulary, it says which way it is set from across a room, and
 * it is already a 44px target (CLAUDE.md "Big, easy touch targets").
 *
 * `busy` shows the one in flight rather than every one on the screen — a page
 * of thirty spinners after one tap tells the reader nothing about which tap
 * it was.
 */
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
      <span className="inline-flex h-7 w-12 items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
        <span className="sr-only">{t("saving")}</span>
      </span>
    );
  }

  return (
    <Switch
      checked={granted}
      onCheckedChange={onChange}
      // Named for a screen reader in full, because "on" alone is meaningless
      // in a grid of thirty of these.
      aria-label={t("toggleLabel", { action: actionLabel, role: t(`role.${role}`) })}
      data-test-selector={testSelectorFor("permission-toggle", `${role}-${action}`)}
      data-action={action}
    />
  );
}
