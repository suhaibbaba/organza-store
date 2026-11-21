"use client";

import { useTranslations } from "next-intl";
import { Avatar, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@store/ui";
import { useSession } from "@/components/providers/session-provider";
import { useUserDisplay } from "@/lib/user-display";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  className?: string;
}

// Who is signed in, at every width for every role (an Employee has no dashboard greeting); mirrors the POS's account menu.
export function AccountMenu({ className }: AccountMenuProps) {
  const t = useTranslations("common");
  const { user, logout } = useSession();

  // Name, else address, else role — never an internal id (lib/user-display.ts).
  const { name, roleLabel } = useUserDisplay()(user);
  const showRole = Boolean(roleLabel) && roleLabel !== name;

  return (
    <Menu>
      <MenuTrigger
        aria-label={t("account")}
        data-test-selector="account-menu"
        className={cn(
          "group flex h-(--control-h) min-w-0 cursor-pointer items-center gap-1.5 rounded-control border border-line bg-surface ps-1 pe-1 sm:pe-2.5",
          "text-label font-medium text-ink transition-colors duration-150",
          "hover:bg-primary-50 data-[state=open]:bg-primary-50",
          className
        )}
      >
        <Avatar name={name} tintKey={user?.id} size={26} />
        <span className="min-w-0 max-w-32 truncate max-sm:sr-only sm:max-w-48">{name}</span>
      </MenuTrigger>

      <MenuContent align="end">
        <MenuLabel>
          <span className="flex flex-col gap-0.5">
            <span className="truncate text-value font-semibold text-ink">{name}</span>
            {showRole && <span className="truncate font-normal text-ink-muted">{roleLabel}</span>}
            {user?.email && <span className="truncate font-normal text-ink-muted">{user.email}</span>}
          </span>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem icon="logout" tone="danger" data-testid="account-menu-logout" onSelect={() => void logout()}>
          {t("logout")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
