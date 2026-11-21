"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Tags } from "lucide-react";
import { Alert, Button, EmptyState, SearchField, Select, Skeleton, TotalBadge, type TableSort } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { DEFAULT_PAGE } from "@store/shared/constants/pagination";
import { EXPENSE_APPROVAL_STATUSES } from "@store/shared/constants/expense";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { RoleGuard } from "@/components/auth/role-guard";
import { useSession } from "@/components/providers/session-provider";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ReportRangePicker } from "@/components/reports/report-range-picker";
import { ExpenseTable } from "@/components/expenses/expense-table";
import { ExpenseFormModal } from "@/components/expenses/expense-form-modal";
import { ExpenseCategoriesDrawer } from "@/components/expenses/expense-categories-drawer";
import { ExpenseCategoryBreakdown, ExpenseSummaryCards } from "@/components/expenses/expense-summary";
import { useExpenseCategoriesQuery, useExpenseSummaryQuery, useExpensesQuery } from "@/hooks/use-expenses";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useTranslateError } from "@/hooks/use-translate-error";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/errors";
import { localize } from "@/lib/i18n-content";
import { rangeForPreset } from "@/lib/report-range";
import {
  DEFAULT_EXPENSE_FILTERS,
  EXPENSE_LIST_URL_PARAMS,
  EXPENSE_NEW_PARAM,
  EXPENSE_SEARCH_DEBOUNCE_MS,
} from "@/constants/expenses";
import type { ExpenseApprovalStatus, ExpenseFormTarget, ExpenseListFilters } from "@/types/expense";
import type { ReportRangeValue } from "@/types/report";

const ALL = "";

// What the shop spent: Admin/Manager (expense.view); only approved money is added up.
export default function ExpensesPage() {
  return (
    <RoleGuard action="expense.view">
      <ExpensesPageContent />
    </RoleGuard>
  );
}

function ExpensesPageContent() {
  const t = useTranslations("expenses");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const translateError = useTranslateError();
  const { user } = useSession();
  const canCreate = can(user, "expense.create");
  const canManage = can(user, "expense.manage");
  const canManageCategories = can(user, "expenseCategory.manage");

  const [filters, changeFilters] = useUrlFilters(DEFAULT_EXPENSE_FILTERS, EXPENSE_LIST_URL_PARAMS);
  const [searchInput, setSearchInput] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q, page: DEFAULT_PAGE }),
    EXPENSE_SEARCH_DEBOUNCE_MS,
  );
  const range = rangeForPreset(filters.preset, filters);

  const list = useExpensesQuery(filters);
  const summary = useExpenseSummaryQuery(filters);
  const { data: categories = [] } = useExpenseCategoriesQuery();
  // The dashboard's "expense" button lands with ?new=1: the form opens at once and the flag is dropped.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const wantsNew = searchParams.get(EXPENSE_NEW_PARAM) !== null;
  const [formTarget, setFormTarget] = useState<ExpenseFormTarget | null>(() =>
    wantsNew && canCreate ? { mode: "create" } : null,
  );
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  useEffect(() => {
    if (!wantsNew) {
      return;
    }
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete(EXPENSE_NEW_PARAM);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [wantsNew, searchParams, router, pathname]);

  function changeRange(next: ReportRangeValue) {
    changeFilters({
      ...(next.preset === "custom" ? next : { preset: next.preset, from: "", to: "" }),
      page: DEFAULT_PAGE,
    });
  }

  function changeCategory(categoryId: string | null) {
    changeFilters({ categoryId, page: DEFAULT_PAGE });
  }

  const tableSort: TableSort = {
    key: filters.sortBy,
    dir: filters.sortDir,
    onChange: (key, dir) =>
      changeFilters(
        key === null
          ? { sortBy: DEFAULT_EXPENSE_FILTERS.sortBy, sortDir: DEFAULT_EXPENSE_FILTERS.sortDir, page: DEFAULT_PAGE }
          : { sortBy: key as ExpenseListFilters["sortBy"], sortDir: dir, page: DEFAULT_PAGE },
      ),
  };

  const hasFilters = Boolean(filters.q.trim() || filters.categoryId || filters.approvalStatus);
  const expenses = list.data?.expenses ?? [];
  const error = list.error ?? summary.error;

  function renderList() {
    if (list.isLoading) {
      return <Skeleton className="h-72 rounded-card" />;
    }
    if (expenses.length === 0) {
      return (
        <EmptyState
          data-testid="expenses-empty"
          icon="wallet"
          title={hasFilters ? "expenses.empty.noMatchesTitle" : "expenses.empty.noneTitle"}
          hint={hasFilters ? "expenses.empty.noMatchesHint" : "expenses.empty.noneHint"}
          action={
            !hasFilters && canCreate ? (
              <Button
                data-test-selector="expenses-empty-add"
                icon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => setFormTarget({ mode: "create" })}
              >
                {t("add")}
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <ExpenseTable
        expenses={expenses}
        meta={list.data?.meta ?? null}
        isRefreshing={list.isFetching}
        sort={tableSort}
        canManage={canManage}
        onEdit={setFormTarget}
        onPageChange={(page) => changeFilters({ page })}
        onPageSizeChange={(pageSize) => changeFilters({ pageSize, page: DEFAULT_PAGE })}
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        name="expenses"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {canManageCategories && (
              <Button
                variant="secondary"
                className="shrink-0"
                data-test-selector="expenses-categories"
                icon={<Tags className="size-4" aria-hidden="true" />}
                onClick={() => setCategoriesOpen(true)}
              >
                {t("categoriesButton")}
              </Button>
            )}
            {canCreate && (
              <Button
                className="shrink-0"
                data-test-selector="add-expense"
                icon={<Plus className="size-4" aria-hidden="true" />}
                onClick={() => setFormTarget({ mode: "create" })}
              >
                {t("add")}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-5">
        <ReportRangePicker name="expenses-range" value={range} onChange={changeRange} />

        {error ? (
          <Alert
            tone="danger"
            data-testid="expenses-error"
            action={
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void list.refetch();
                  void summary.refetch();
                }}
              >
                {tCommon("retry")}
              </Button>
            }
          >
            {translateError(error instanceof ApiError ? error.code : "error.internal")}
          </Alert>
        ) : summary.data ? (
          <ExpenseSummaryCards summary={summary.data} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-card" />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-64 flex-1 sm:max-w-sm">
                <SearchField
                  data-testid="expenses-search"
                  label={t("search.label")}
                  placeholder={t("search.placeholder")}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onClear={() => setSearchInput("")}
                  clearLabel={t("search.clear")}
                />
              </div>
              <div className="w-44">
                <Select
                  data-testid={fieldTestSelector("expenses-category")}
                  aria-label={t("filters.category")}
                  placeholder={t("filters.allCategories")}
                  options={[
                    { value: ALL, label: t("filters.allCategories") },
                    ...categories.map((category) => ({ value: category.id, label: localize(category.name, locale) })),
                  ]}
                  value={filters.categoryId ?? ALL}
                  onChange={(event) => changeCategory(event.target.value || null)}
                />
              </div>
              <div className="w-40">
                <Select
                  data-testid={fieldTestSelector("expenses-status")}
                  aria-label={t("filters.status")}
                  placeholder={t("filters.allStatuses")}
                  options={[
                    { value: ALL, label: t("filters.allStatuses") },
                    ...EXPENSE_APPROVAL_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
                  ]}
                  value={filters.approvalStatus ?? ALL}
                  onChange={(event) =>
                    changeFilters({
                      approvalStatus: (event.target.value || null) as ExpenseApprovalStatus | null,
                      page: DEFAULT_PAGE,
                    })
                  }
                />
              </div>
              {list.data?.meta && (
                <div className="ms-auto flex h-(--control-h) items-center">
                  <TotalBadge data-testid="expenses-count" total={list.data.meta.total} />
                </div>
              )}
            </div>
            {renderList()}
          </div>

          {summary.data && (
            <ExpenseCategoryBreakdown
              summary={summary.data}
              categories={categories}
              activeId={filters.categoryId}
              onSelect={changeCategory}
            />
          )}
        </div>
      </div>

      <ExpenseFormModal target={formTarget} onClose={() => setFormTarget(null)} />
      {canManageCategories && <ExpenseCategoriesDrawer open={categoriesOpen} onOpenChange={setCategoriesOpen} />}
    </PageContainer>
  );
}
