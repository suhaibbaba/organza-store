"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { can } from "@store/shared/lib/permissions";
import { Typography } from "@store/ui";
import { Link } from "@/i18n/navigation";
import { DetailCard } from "@/components/layout/detail-card";
import { useSession } from "@/components/providers/session-provider";
import { useChangeRequestCountQuery } from "@/hooks/use-change-requests";
import { useCollectionSummaryQuery } from "@/hooks/use-orders";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { cn } from "@/lib/utils";
import { DASHBOARD_TODOS } from "@/constants/dashboard";
import type { DashboardTodoListProps, DashboardTodoRow } from "@/types/dashboard";

// Each row opens the screen that clears it; a row the role cannot act on is left out, a zero row stays but reads muted.
export function DashboardTodoList({ summary, drawer }: DashboardTodoListProps) {
  const t = useTranslations("dashboard.todo");
  const formatMoney = useMoneyFormatter();
  const { user } = useSession();
  const { data: approvals } = useChangeRequestCountQuery();
  const canCollect = can(user, "order.markCollected");
  const { data: collection } = useCollectionSummaryQuery();

  const approvalCount = approvals?.pending ?? 0;
  const owed = Number(collection?.amount ?? 0);
  const followUps = drawer?.openFollowUpCount ?? 0;

  const rows: DashboardTodoRow[] = [
    ...(can(user, "changeRequest.view")
      ? [{ key: "approvals", value: approvalCount, active: approvalCount > 0 } as const]
      : []),
    ...(can(user, "product.complete")
      ? [{ key: "incomplete", value: summary.incompleteProducts, active: summary.incompleteProducts > 0 } as const]
      : []),
    ...(can(user, "product.printLabels")
      ? [{ key: "labels", value: summary.unprintedLabels, active: summary.unprintedLabels > 0 } as const]
      : []),
    { key: "lowStock", value: summary.lowStock.count, active: summary.lowStock.count > 0 },
    ...(canCollect
      ? [{ key: "uncollected", value: formatMoney(collection?.amount ?? "0"), active: owed > 0 } as const]
      : []),
    ...(drawer ? [{ key: "followUps", value: followUps, active: followUps > 0 } as const] : []),
  ];

  return (
    <DetailCard
      icon={ListChecks}
      title={t("title")}
      data-testid="dashboard-todo"
      className="animate-rise overflow-hidden px-0 pb-2 [animation-delay:400ms] [&>header]:px-5"
    >
      <ul className="flex flex-col">
        {rows.map((row) => (
          <TodoRow key={row.key} row={row} label={t(row.key)} />
        ))}
      </ul>
    </DetailCard>
  );
}

function TodoRow({ row, label }: { row: DashboardTodoRow; label: string }) {
  const { icon: Icon, href } = DASHBOARD_TODOS[row.key];

  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-control",
          row.active ? "bg-warning-100 text-warning-700" : "bg-sunken text-ink-subtle",
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <Typography variant="body" as="span" className={cn("min-w-0 flex-1", !row.active && "text-ink-muted")}>
        {label}
      </Typography>
      <span
        className={cn("shrink-0 font-bold tabular-nums", row.active ? "text-warning-700" : "text-ink-subtle")}
        data-test-selector={`dashboard-todo-${row.key}-value`}
      >
        {row.value}
      </span>
      {href && (
        <>
          <ChevronLeft className="hidden size-4 shrink-0 text-ink-subtle rtl:block" aria-hidden="true" />
          <ChevronRight className="size-4 shrink-0 text-ink-subtle rtl:hidden" aria-hidden="true" />
        </>
      )}
    </>
  );

  const rowClass = "flex min-h-14 items-center gap-3 px-5";

  return (
    <li data-test-selector={`dashboard-todo-${row.key}`}>
      {href ? (
        <Link href={href} className={cn(rowClass, "transition-colors hover:bg-row-hover focus-visible:bg-inset")}>
          {content}
        </Link>
      ) : (
        <div className={rowClass}>{content}</div>
      )}
    </li>
  );
}
