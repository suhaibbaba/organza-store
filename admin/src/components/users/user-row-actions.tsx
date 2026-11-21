"use client";

import { useTranslations } from "next-intl";
import { Pencil, UserCheck, UserX } from "lucide-react";
import { Button } from "@store/ui";
import type { User } from "@organza/shared/types/user";

// Removing opens the sheet that explains deactivate vs delete; putting somebody back is one tap with an inline confirm.
export interface UserRowActionsProps {
  user: User;
  onEdit: (user: User) => void;
  /** Active accounts only — opens the sheet that explains the two removals. */
  onRemove: (user: User) => void;
  confirmActivateId: string | null;
  onRequestActivate: (id: string) => void;
  onCancelActivate: () => void;
  onConfirmActivate: (user: User) => void;
  activatingId: string | null;
  /** The card wants 44px targets; the table's rows are tighter. */
  size?: "card" | "table";
}

export function UserRowActions({
  user,
  onEdit,
  onRemove,
  confirmActivateId,
  onRequestActivate,
  onCancelActivate,
  onConfirmActivate,
  activatingId,
  size = "card",
}: UserRowActionsProps) {
  const t = useTranslations("users.card");
  const isConfirming = confirmActivateId === user.id;
  const isActivating = activatingId === user.id;
  const button = size === "card" ? "size-11 px-0" : "size-10 px-0";

  if (isConfirming) {
    return (
      <div className="flex shrink-0 items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onConfirmActivate(user)}
          disabled={isActivating}
        >
          {t("confirmActivate")}
        </Button>
        <Button type="button" variant="quiet" onClick={onCancelActivate}>
          {t("cancelToggle")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <Button
        type="button"
        variant="quiet"
        onClick={() => onEdit(user)}
        aria-label={t("edit")}
        className={button}
        icon={<Pencil className="size-4" aria-hidden="true" />}
      />

      {user.isActive ? (
        <Button
          type="button"
          variant="quiet"
          onClick={() => onRemove(user)}
          aria-label={t("remove")}
          className={button}
          icon={<UserX className="size-4" aria-hidden="true" />}
        />
      ) : (
        <Button
          type="button"
          variant="quiet"
          onClick={() => onRequestActivate(user.id)}
          aria-label={t("activate")}
          isLoading={isActivating}
          className={button}
          icon={<UserCheck className="size-4" aria-hidden="true" />}
        />
      )}
    </div>
  );
}
