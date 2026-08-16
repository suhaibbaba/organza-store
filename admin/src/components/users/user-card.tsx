"use client";

import { useTranslations } from "next-intl";
import type { User } from "@organza/shared/types/user";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/users/role-badge";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { AccountStateBadge } from "@/components/users/account-state-badge";
import { UserRowActions, type UserRowActionsProps } from "@/components/users/user-row-actions";

type UserCardProps = Omit<UserRowActionsProps, "size">;

export function UserCard({ user, ...actions }: UserCardProps) {
  const t = useTranslations("users.card");
  const initials = user.name.trim().slice(0, 1).toUpperCase();

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {user.email}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <RoleBadge role={user.role} />
          {/* The two questions a row has to answer about an account, and they
              are different ones: whether it is ALLOWED to sign in, and whether
              it CAN yet. Together with "active" they are the three states an
              Admin actually sees — active, deactivated, invited-but-pending. */}
          <UserStatusBadge isActive={user.isActive} />
          <AccountStateBadge hasPassword={user.hasPassword} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <span className="truncate text-xs text-muted-foreground" dir="ltr">
          {user.phone}
        </span>
        <span className="sr-only">{t("actionsFor", { name: user.name })}</span>
        <UserRowActions user={user} size="card" {...actions} />
      </div>
    </div>
  );
}
