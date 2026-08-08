"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Pencil, UserCheck, UserX } from "lucide-react";
import type { User } from "@shared/types/user";
import { Spinner } from "@/components/ui/spinner";
import { RoleBadge } from "@/components/users/role-badge";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { AccountStateBadge } from "@/components/users/account-state-badge";

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  confirmToggleId: string | null;
  onRequestToggle: (id: string) => void;
  onCancelToggle: () => void;
  onConfirmToggle: (user: User) => void;
  togglingId: string | null;
}

export function UserTable({ users, onEdit, confirmToggleId, onRequestToggle, onCancelToggle, onConfirmToggle, togglingId }: UserTableProps) {
  const tTable = useTranslations("users.table");
  const tCard = useTranslations("users.card");

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
        cell: ({ row }) => {
          const user = row.original;
          const isConfirming = confirmToggleId === user.id;
          const isToggling = togglingId === user.id;

          if (isConfirming) {
            return (
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => onConfirmToggle(user)}
                  disabled={isToggling}
                  className={user.isActive ? "text-xs font-semibold text-destructive" : "text-xs font-semibold text-primary"}
                >
                  {user.isActive ? tCard("confirmDeactivate") : tCard("confirmActivate")}
                </button>
                <button type="button" onClick={onCancelToggle} className="text-xs text-muted-foreground">
                  {tCard("cancelToggle")}
                </button>
              </div>
            );
          }

          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => onEdit(user)}
                aria-label={tCard("edit")}
                className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onRequestToggle(user.id)}
                aria-label={user.isActive ? tCard("deactivate") : tCard("activate")}
                disabled={isToggling}
                className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                {isToggling ? <Spinner className="size-4" /> : user.isActive ? <UserX className="size-4" aria-hidden="true" /> : <UserCheck className="size-4" aria-hidden="true" />}
              </button>
            </div>
          );
        },
      },
    ],
    [tTable, tCard, confirmToggleId, togglingId, onEdit, onRequestToggle, onCancelToggle, onConfirmToggle]
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
