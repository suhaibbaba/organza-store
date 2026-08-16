"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import type { User } from "@organza/shared/types/user";
import { RoleBadge } from "@/components/users/role-badge";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { AccountStateBadge } from "@/components/users/account-state-badge";
import { UserRowActions, type UserRowActionsProps } from "@/components/users/user-row-actions";

type UserTableProps = Omit<UserRowActionsProps, "user" | "size"> & { users: User[] };

export function UserTable({ users, ...actions }: UserTableProps) {
  const tTable = useTranslations("users.table");

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "name",
        header: tTable("name"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        id: "role",
        header: tTable("role"),
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "phone",
        header: tTable("phone"),
        cell: ({ row }) => (
          <span dir="ltr" className="text-muted-foreground">
            {row.original.phone}
          </span>
        ),
      },
      {
        id: "status",
        header: tTable("status"),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <UserStatusBadge isActive={row.original.isActive} />
            <AccountStateBadge hasPassword={row.original.hasPassword} />
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <UserRowActions user={row.original} size="table" {...actions} />,
      },
    ],
    [tTable, actions]
  );

  const table = useReactTable({ data: users, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-secondary-foreground">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 text-start font-medium">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
