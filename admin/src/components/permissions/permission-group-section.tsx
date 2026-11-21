"use client";

import { useTranslations } from "next-intl";
import { Badge, Section, Switch, Typography } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { EDITABLE_ROLES } from "@/constants/permissions";
import { cn } from "@/lib/utils";
import type { PermissionGroupSectionProps } from "@/types/permission";

const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 lg:grid-cols-[minmax(0,1fr)_6rem_6rem]";

// One part of the shop: a row per permission, a switch per role; a changed row is tinted until Save.
export function PermissionGroupSection({
  group,
  actions,
  grid,
  saved,
  phoneRole,
  forceOpen,
  defaultOpen,
  lockedReason,
  onToggle,
}: PermissionGroupSectionProps) {
  const t = useTranslations("permissions");

  const summary = EDITABLE_ROLES.map((role) =>
    t("summary", {
      role: t(`role.${role}`),
      granted: group.actions.filter((action) => grid[role].has(action)).length,
      total: group.actions.length,
    }),
  ).join(" · ");

  return (
    <Section
      data-testid={testSelectorFor("permission-group", group.key)}
      collapsible
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      icon={group.icon}
      tone={group.tone}
      title={t(`groups.${group.key}`)}
      description={summary}
      bodyClassName="gap-0 p-0"
    >
      <div className={cn(ROW_GRID, "hidden border-b border-line bg-table-head px-4 py-2 lg:grid")} aria-hidden="true">
        <Typography variant="caption" tone="muted" as="span">
          {t("table.action")}
        </Typography>
        {EDITABLE_ROLES.map((role) => (
          <Typography key={role} variant="caption" tone="muted" as="span" className="text-center">
            {t(`role.${role}`)}
          </Typography>
        ))}
      </div>

      <ul className="divide-y divide-line">
        {actions.map((action) => {
          const label = t(`actions.${action}`);
          const changed = EDITABLE_ROLES.some((role) => grid[role].has(action) !== saved[role].has(action));
          return (
            <li
              key={action}
              data-test-selector={testSelectorFor("permission-row", action)}
              className={cn(ROW_GRID, "px-4 py-3 transition-colors", changed ? "bg-selected" : "hover:bg-row-hover")}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <Typography variant="body" as="span">
                  {label}
                </Typography>
                {changed && <Badge tone="warning">{t("changed")}</Badge>}
              </span>

              {EDITABLE_ROLES.map((role) => {
                const reason = lockedReason(role, action);
                const granted = grid[role].has(action);
                return (
                  <span key={role} className={cn("justify-center", role === phoneRole ? "flex" : "hidden lg:flex")}>
                    {reason ? (
                      <Badge tone="neutral" icon="lock">
                        {reason === "protected" ? t("locked.label") : t(granted ? "locked.on" : "locked.off")}
                      </Badge>
                    ) : (
                      <Switch
                        data-testid={testSelectorFor("permission-toggle", `${role}-${action}`)}
                        label={t("toggleLabel", { action: label, role: t(`role.${role}`) })}
                        hideLabel
                        checked={granted}
                        onCheckedChange={(next) => onToggle(role, action, next)}
                      />
                    )}
                  </span>
                );
              })}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
