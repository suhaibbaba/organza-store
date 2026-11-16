"use client";

import { useTranslations } from "next-intl";
import { Pencil, UserCheck, UserX } from "lucide-react";
import type { User } from "@organza/shared/types/user";
import { Spinner } from "@/components/ui/spinner";

// The buttons on one staff row, in one place — the phone card and the desktop
// table render the same three and used to carry two copies of them.
//
// The asymmetry between the two directions is deliberate:
//
//   REMOVING somebody opens the removal sheet, which is where the difference
//   between "they can no longer sign in, their history stays" and "this
//   account is erased" gets explained. It is never a single tap on a list
//   row, because those two are not the same act and a row has no room to say
//   so (components/users/user-remove-sheet.tsx).
//
//   PUTTING somebody BACK is a single tap with an inline confirm. It destroys
//   nothing, it is reversible by the button next to it, and making an Admin
//   read a panel to re-enable somebody who is standing in front of them
//   waiting to start their shift would be ceremony for its own sake.
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
  /** The card wants 44px targets (CLAUDE.md); the table's rows are tighter. */
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
  const button = size === "card" ? "size-11" : "size-10";

  if (isConfirming) {
    return (
      <div className="flex shrink-0 items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => onConfirmActivate(user)}
          disabled={isActivating}
          className="text-xs font-semibold text-primary"
        >
          {t("confirmActivate")}
        </button>
        <button type="button" onClick={onCancelActivate} className="text-xs text-muted-foreground">
          {t("cancelToggle")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onEdit(user)}
        aria-label={t("edit")}
        className={`inline-flex ${button} items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
      >
        <Pencil className="size-4" aria-hidden="true" />
      </button>

      {user.isActive ? (
        <button
          type="button"
          onClick={() => onRemove(user)}
          aria-label={t("remove")}
          className={`inline-flex ${button} items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
        >
          <UserX className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onRequestActivate(user.id)}
          aria-label={t("activate")}
          disabled={isActivating}
          className={`inline-flex ${button} items-center justify-center rounded-lg text-muted-foreground not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isActivating ? <Spinner className="size-4" /> : <UserCheck className="size-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
