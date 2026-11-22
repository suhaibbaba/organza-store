"use client";

import { useTranslations } from "next-intl";
import { Avatar, Icon, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@store/ui";
import { TOP_BAR_PILL } from "@/components/layout/top-bar-pill";
import { useSession } from "@/components/providers/session-provider";
import { useRouter } from "@/i18n/navigation";
import { PROFILE_HREF } from "@/constants/profile";
import { useUserDisplay } from "@/lib/user-display";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  className?: string;
}

// Who is signed in, and the way out: a pill beside the language one, with the role and address inside the menu.
export function AccountMenu({ className }: AccountMenuProps) {
  const t = useTranslations("common");
  const { user, logout, lock, canLock } = useSession();
  const router = useRouter();

  // Name, address or role — never an internal id; the letter comes from the same source as the name.
  const { name, initial } = useUserDisplay()(user);
  const tRole = useTranslations("common.role");
  const roleLabel = user?.role ? tRole(user.role) : null;

  return (
    <Menu>
      <MenuTrigger
        aria-label={t("account")}
        data-test-selector="pos-account-menu"
        className={cn(TOP_BAR_PILL, "ps-1.5", className)}
      >
        <Avatar name={initial} size={32} />
        {/* Below 600px the bar has room for the avatar only; capped so a long name never widens the bar. */}
        <span className="hidden min-w-0 max-w-40 truncate text-label font-semibold tab:block">{name}</span>
        <Icon name="chevron-down" className="size-4 shrink-0 text-ink-muted" />
      </MenuTrigger>

      <MenuContent align="end">
        <MenuLabel>
          <span className="flex flex-col gap-0.5">
            <span className="truncate font-semibold text-ink">{name}</span>
            {roleLabel && <span className="truncate text-micro font-normal text-ink-muted">{roleLabel}</span>}
            {user?.email && <span className="truncate text-micro font-normal text-ink-muted">{user.email}</span>}
          </span>
        </MenuLabel>
        <MenuSeparator />

        <MenuItem icon="user" data-testid="pos-account-menu-profile" onSelect={() => router.push(PROFILE_HREF)}>
          {t("profile")}
        </MenuItem>
        {/* Locks for the next person; this person's open sale waits for their passcode. */}
        {canLock && (
          <MenuItem icon="users" data-testid="pos-account-menu-switch" onSelect={() => void lock()}>
            {t("switchUser")}
          </MenuItem>
        )}
        <MenuItem icon="logout" tone="danger" onSelect={() => void logout()}>
          {t("logout")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
