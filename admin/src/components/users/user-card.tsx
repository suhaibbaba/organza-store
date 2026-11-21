"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@store/ui";
import { RoleBadge } from "@/components/users/role-badge";
import { useUserDisplay } from "@/lib/user-display";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { AccountStateBadge } from "@/components/users/account-state-badge";
import { UserRowActions, type UserRowActionsProps } from "@/components/users/user-row-actions";

type UserCardProps = Omit<UserRowActionsProps, "size">;

export function UserCard({ user, ...actions }: UserCardProps) {
  const t = useTranslations("users.card");
  const { name } = useUserDisplay()(user);

  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} tintKey={user.id} size={40} />
          <div className="min-w-0">
            <p className="truncate text-label font-medium text-ink">{name}</p>
            <p className="truncate text-meta text-ink-muted" dir="ltr">
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <RoleBadge role={user.role} />
          <UserStatusBadge isActive={user.isActive} />
          <AccountStateBadge hasPassword={user.hasPassword} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
        <span className="truncate text-meta text-ink-muted" dir="ltr">
          {user.phone}
        </span>
        <span className="sr-only">{t("actionsFor", { name })}</span>
        <UserRowActions user={user} size="card" {...actions} />
      </div>
    </div>
  );
}
