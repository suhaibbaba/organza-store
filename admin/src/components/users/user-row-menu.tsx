"use client";

import { useTranslations } from "next-intl";
import { MenuItem, RowMenu, useConfirm, useToast } from "@store/ui";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import type { User } from "@organza/shared/types/user";
import { useToggleUserActiveMutation } from "@/hooks/use-users";
import { useUserDisplay } from "@/lib/user-display";
import { ApiError } from "@/lib/api/errors";

// Removing opens the modal that explains deactivate vs erase; putting somebody back is one confirm.
export function useUserRowMenu({ onEdit, onRemove }: { onEdit: (user: User) => void; onRemove: (user: User) => void }) {
  const t = useTranslations("users");
  const display = useUserDisplay();
  const toast = useToast();
  const toggle = useToggleUserActiveMutation();
  const { confirm, dialog } = useConfirm("user-activate-confirm");

  function requestActivate(user: User) {
    confirm({
      title: "users.activate.title",
      titleValues: { name: display(user).name },
      consequences: [t("activate.consequence")],
      confirmLabel: "users.activate.confirm",
      tone: "primary",
      onConfirm: async () => {
        try {
          await toggle.mutateAsync({ id: user.id, isActive: true });
          toast.success("users.activate.success");
        } catch (error) {
          toast.error(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL);
          throw error;
        }
      },
    });
  }

  function renderMenu(user: User) {
    return (
      <RowMenu data-testid={`user-menu-${user.id}`} label={t("rowMenu.label", { name: display(user).name })}>
        <MenuItem icon="edit" data-testid="user-menu-edit" onSelect={() => onEdit(user)}>
          {t("rowMenu.edit")}
        </MenuItem>
        {user.isActive ? (
          <MenuItem icon="lock" tone="danger" data-testid="user-menu-remove" onSelect={() => onRemove(user)}>
            {t("rowMenu.remove")}
          </MenuItem>
        ) : (
          <MenuItem icon="check" data-testid="user-menu-activate" onSelect={() => requestActivate(user)}>
            {t("rowMenu.activate")}
          </MenuItem>
        )}
      </RowMenu>
    );
  }

  return { renderMenu, dialog };
}
