"use client";

import { useTranslations } from "next-intl";
import { ReceiptText } from "lucide-react";
import { buttonClassName, EmptyState, Skeleton } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { DEFAULT_PAGE } from "@store/shared/constants/pagination";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSession } from "@/components/providers/session-provider";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ReportRangePicker } from "@/components/reports/report-range-picker";
import { ReportHeadline } from "@/components/reports/report-headline";
import { ReportError } from "@/components/reports/report-states";
import { SoldItemsTable } from "@/components/sales/sold-items-table";
import { SalesReturnsNote } from "@/components/sales/sales-returns-note";
import { useSalesPeriodQuery, useSoldItemsQuery } from "@/hooks/use-sales";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { Link } from "@/i18n/navigation";
import { rangeForPreset } from "@/lib/report-range";
import { DEFAULT_SALES_FILTERS, SALES_LOG_URL_PARAMS, SALES_PRESETS } from "@/constants/sales";
import type { ReportRangeValue } from "@/types/report";

// What sold in a range and which pieces left the shop: sales.view (Admin/Manager), cost/profit again behind product.viewCost.
export default function SalesPage() {
  return (
    <RoleGuard action="sales.view">
      <SalesPageContent />
    </RoleGuard>
  );
}

function SalesPageContent() {
  const t = useTranslations("sales");
  const { user } = useSession();
  const [filters, changeFilters] = useUrlFilters(DEFAULT_SALES_FILTERS, SALES_LOG_URL_PARAMS);
  const range = rangeForPreset(filters.preset, filters);

  const period = useSalesPeriodQuery(range.from, range.to);
  const list = useSoldItemsQuery(range.from, range.to, filters);
  const error = period.error ?? list.error;
  const isEmpty =
    period.data !== undefined && period.data.totals.orderCount === 0 && period.data.returns.itemCount === 0;
  const ordersHref = `/orders?${new URLSearchParams({ dateFrom: range.from, dateTo: range.to }).toString()}`;

  function changeRange(next: ReportRangeValue) {
    changeFilters({
      ...(next.preset === "custom" ? next : { preset: next.preset, from: "", to: "" }),
      page: DEFAULT_PAGE,
    });
  }

  function renderBody() {
    if (error) {
      return (
        <ReportError
          error={error}
          onRetry={() => {
            void period.refetch();
            void list.refetch();
          }}
        />
      );
    }
    if (!period.data) {
      return (
        <div className="flex flex-col gap-5" aria-busy="true">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-card" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-card" />
        </div>
      );
    }
    if (isEmpty) {
      return <EmptyState data-testid="sales-empty" icon="trend-up" title="sales.empty.title" hint="sales.empty.hint" />;
    }
    return (
      <div className="flex flex-col gap-5">
        <ReportHeadline totals={period.data.totals} />
        <SalesReturnsNote returns={period.data.returns} />
        {list.data ? (
          <SoldItemsTable
            items={list.data.items}
            meta={list.data.meta}
            isRefreshing={list.isFetching}
            sortBy={filters.sortBy}
            onSortChange={(sortBy) => changeFilters({ sortBy, page: DEFAULT_PAGE })}
            onPageChange={(page) => changeFilters({ page })}
            onPageSizeChange={(pageSize) => changeFilters({ pageSize, page: DEFAULT_PAGE })}
          />
        ) : (
          <Skeleton className="h-96 rounded-card" />
        )}
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        name="sales"
        title={t("title")}
        description={t("subtitle")}
        actions={
          can(user, "order.view") ? (
            <Link
              href={ordersHref}
              data-test-selector="sales-open-orders"
              className={buttonClassName({ variant: "secondary" })}
            >
              <ReceiptText className="size-4" aria-hidden="true" />
              {t("openOrders")}
            </Link>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-5">
        <ReportRangePicker name="sales-range" presets={SALES_PRESETS} value={range} onChange={changeRange} />
        {renderBody()}
      </div>
    </PageContainer>
  );
}
