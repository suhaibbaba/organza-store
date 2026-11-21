"use client";

import { useTranslations } from "next-intl";
import { Avatar, Badge, PhoneLink, Table, Typography, WhatsAppLink, type Column } from "@store/ui";
import { PAGE_SIZE_OPTIONS } from "@organza/shared/constants/pagination";
import type { User } from "@organza/shared/types/user";
import { useSession } from "@/components/providers/session-provider";
import { useUserDisplay } from "@/lib/user-display";
import { RoleBadge } from "@/components/users/role-badge";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { AccountStateBadge } from "@/components/users/account-state-badge";
import { USER_AVATAR_SIZE } from "@/constants/users";
import type { UserTableProps } from "@/types/user";

// Rows are named `users-row-<id>` by the Table (its data-testid + "-row-" + rowKey).
const TABLE_NAME = "users";

export function UserTable({
  users,
  meta,
  isLoading,
  isRefreshing,
  sort,
  onPageChange,
  onPageSizeChange,
  renderMenu,
}: UserTableProps) {
  const t = useTranslations("users");
  const display = useUserDisplay();
  const { user: currentUser } = useSession();

  function renderPerson(user: User) {
    const { name } = display(user);
    return (
      <div className="flex items-start gap-3">
        <Avatar name={name} tintKey={user.id} size={USER_AVATAR_SIZE} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Typography variant="body" weight="medium" as="span" className="break-words">
              {name}
            </Typography>
            {currentUser?.id === user.id && <Badge tone="info">{t("table.you")}</Badge>}
          </div>
          <Typography variant="small" tone="muted" as="span" dir="ltr" className="self-start break-all">
            {user.email}
          </Typography>
          <AccountStateBadge hasPassword={user.hasPassword} />
        </div>
      </div>
    );
  }

  const columns: Column<User>[] = [
    {
      key: "person",
      header: "users.table.name",
      primary: true,
      sortKey: "name",
      className: "min-w-[16rem] [--cell-max:24rem]",
      render: renderPerson,
    },
    {
      key: "role",
      header: "users.table.role",
      sortKey: "role",
      render: (user) => <RoleBadge role={user.role} />,
    },
    {
      key: "contact",
      header: "users.table.contact",
      render: (user) => (
        <div className="flex flex-col items-start gap-1">
          <PhoneLink value={user.phone} data-testid={`user-phone-${user.id}`} />
          {user.whatsapp && <WhatsAppLink value={user.whatsapp} label={t("table.whatsapp")} />}
        </div>
      ),
    },
    {
      key: "status",
      header: "users.table.status",
      render: (user) => <UserStatusBadge isActive={user.isActive} />,
    },
    {
      key: "actions",
      header: "users.table.actions",
      actions: true,
      besideTitleOnMobile: true,
      align: "end",
      className: "align-top",
      render: renderMenu,
    },
  ];

  return (
    <Table
      data-testid={TABLE_NAME}
      columns={columns}
      rows={users}
      rowKey={(user) => user.id}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      sort={sort}
      {...(meta && {
        pagination: {
          "data-testid": "users-pagination",
          page: meta.page,
          totalPages: Math.max(meta.totalPages, 1),
          perPage: meta.pageSize,
          perPageOptions: PAGE_SIZE_OPTIONS,
          onPageChange,
          onPerPageChange: onPageSizeChange,
        },
      })}
    />
  );
}
