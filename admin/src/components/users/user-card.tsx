"use client";

import { useTranslations } from "next-intl";
import { Pencil, UserCheck, UserX } from "lucide-react";
import type { User } from "@shared/types/user";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { RoleBadge } from "@/components/users/role-badge";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { AccountStateBadge } from "@/components/users/account-state-badge";

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  confirmToggleId: string | null;
  onRequestToggle: (id: string) => void;
  onCancelToggle: () => void;
  onConfirmToggle: (user: User) => void;
  togglingId: string | null;
}

export function UserCard({ user, onEdit, confirmToggleId, onRequestToggle, onCancelToggle, onConfirmToggle, togglingId }: UserCardProps) {
  const t = useTranslations("users.card");
  const initials = user.name.trim().slice(0, 1).toUpperCase();
  const isConfirming = confirmToggleId === user.id;
  const isToggling = togglingId === user.id;

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
          <UserStatusBadge isActive={user.isActive} />
          <AccountStateBadge hasPassword={user.hasPassword} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <span className="truncate text-xs text-muted-foreground" dir="ltr">
          {user.phone}
        </span>

        {!isConfirming ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(user)}
              aria-label={t("edit")}
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onRequestToggle(user.id)}
              aria-label={user.isActive ? t("deactivate") : t("activate")}
              disabled={isToggling}
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {isToggling ? (
                <Spinner className="size-4" />
              ) : user.isActive ? (
                <UserX className="size-4" aria-hidden="true" />
              ) : (
                <UserCheck className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => onConfirmToggle(user)}
              disabled={isToggling}
              className={user.isActive ? "text-xs font-semibold text-destructive" : "text-xs font-semibold text-primary"}
            >
              {user.isActive ? t("confirmDeactivate") : t("confirmActivate")}
            </button>
            <button type="button" onClick={onCancelToggle} className="text-xs text-muted-foreground">
              {t("cancelToggle")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
