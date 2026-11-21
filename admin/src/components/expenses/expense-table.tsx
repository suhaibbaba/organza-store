"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Badge,
  MenuItem,
  RowMenu,
  Table,
  Typography,
  useConfirm,
  useToast,
  type Column,
  type TableSort,
} from "@store/ui";
import { PAGE_SIZE_OPTIONS } from "@store/shared/constants/pagination";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import type { Pagination } from "@store/shared/types/common";
import { useDeleteExpenseMutation } from "@/hooks/use-expenses";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { errorMessageKey } from "@/lib/error-message-key";
import { formatDate } from "@/lib/format";
import { localize } from "@/lib/i18n-content";
import { EXPENSE_STATUS_TONE } from "@/constants/expenses";
import type { Expense, ExpenseFormTarget } from "@/types/expense";

interface ExpenseTableProps {
  expenses: Expense[];
  meta: Pagination | null;
  isRefreshing: boolean;
  sort: TableSort;
  canManage: boolean;
  onEdit: (target: ExpenseFormTarget) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

// Rows are `expenses-row-<id>`; an approved expense shows no status badge, only the exceptions do.
export function ExpenseTable({
  expenses,
  meta,
  isRefreshing,
  sort,
  canManage,
  onEdit,
  onPageChange,
  onPageSizeChange,
}: ExpenseTableProps) {
  const t = useTranslations("expenses");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const toast = useToast();
  const remove = useDeleteExpenseMutation();
  const { confirm, dialog } = useConfirm("expense-delete-confirm");

  function categoryName(expense: Expense) {
    return expense.category ? localize(expense.category.name, locale) : t("table.noCategory");
  }

  function requestDelete(expense: Expense) {
    confirm({
      title: "expenses.delete.title",
      titleValues: { name: categoryName(expense), amount: formatMoney(expense.amount) },
      consequences: [t("delete.consequence")],
      confirmLabel: "expenses.delete.confirm",
      tone: "danger",
      onConfirm: async () => {
        try {
          await remove.mutateAsync(expense.id);
          toast.success("expenses.delete.success");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  }

  const columns: Column<Expense>[] = [
    {
      key: "category",
      header: "expenses.table.category",
      primary: true,
      className: "min-w-[12rem] [--cell-max:22rem]",
      render: (expense) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <Typography variant="body" weight="medium" as="span">
              {categoryName(expense)}
            </Typography>
            {expense.isRecurring && (
              <Badge tone="info" icon="clock">
                {t("table.recurring")}
              </Badge>
            )}
            {expense.approvalStatus !== "APPROVED" && (
              <Badge tone={EXPENSE_STATUS_TONE[expense.approvalStatus]}>{t(`status.${expense.approvalStatus}`)}</Badge>
            )}
          </span>
          {expense.note && (
            <Typography variant="small" tone="muted" as="span" className="line-clamp-2">
              {expense.note}
            </Typography>
          )}
        </div>
      ),
    },
    {
      key: "date",
      header: "expenses.table.date",
      sortKey: "date",
      render: (expense) => (
        <Typography variant="body" as="span" className="whitespace-nowrap tabular-nums">
          {formatDate(expense.date, locale)}
        </Typography>
      ),
    },
    {
      key: "paidFrom",
      header: "expenses.table.paidFrom",
      render: (expense) => (
        <Badge tone={expense.paidInCash ? "warning" : "neutral"} icon={expense.paidInCash ? "wallet" : "banknote"}>
          {expense.paidInCash ? t("table.cash") : t("table.other")}
        </Badge>
      ),
    },
    {
      key: "createdBy",
      header: "expenses.table.createdBy",
      hideOnMobile: true,
      render: (expense) => (
        <Typography variant="small" tone="muted" as="span">
          {expense.createdBy?.name ?? ""}
        </Typography>
      ),
    },
    {
      key: "amount",
      header: "expenses.table.amount",
      sortKey: "amount",
      align: "numeric",
      render: (expense) => (
        <Typography variant="body" weight="semibold" as="span" className="whitespace-nowrap tabular-nums">
          {formatMoney(expense.amount)}
        </Typography>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "expenses.table.actions",
            actions: true,
            besideTitleOnMobile: true,
            align: "end",
            className: "align-top",
            render: (expense: Expense) => (
              <RowMenu
                data-testid={testSelectorFor("expense-menu", expense.id)}
                label={t("menu.label", { name: categoryName(expense) })}
              >
                <MenuItem
                  icon="edit"
                  data-testid="expense-menu-edit"
                  onSelect={() => onEdit({ mode: "edit", expense })}
                >
                  {t("menu.edit")}
                </MenuItem>
                <MenuItem
                  icon="trash"
                  tone="danger"
                  data-testid="expense-menu-delete"
                  onSelect={() => requestDelete(expense)}
                >
                  {t("menu.delete")}
                </MenuItem>
              </RowMenu>
            ),
          } satisfies Column<Expense>,
        ]
      : []),
  ];

  return (
    <>
      <Table
        data-testid="expenses"
        columns={columns}
        rows={expenses}
        rowKey={(expense) => expense.id}
        isRefreshing={isRefreshing}
        sort={sort}
        {...(meta && {
          pagination: {
            "data-testid": "expenses-pagination",
            page: meta.page,
            totalPages: Math.max(meta.totalPages, 1),
            perPage: meta.pageSize,
            perPageOptions: PAGE_SIZE_OPTIONS,
            onPageChange,
            onPerPageChange: onPageSizeChange,
          },
        })}
      />
      {dialog}
    </>
  );
}
