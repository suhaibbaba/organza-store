"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Eye, Tags } from "lucide-react";
import { Alert, Button, SearchField, SegmentedControl, TotalBadge, useToast } from "@store/ui";
import { DEFAULT_PAGE } from "@store/shared/constants/pagination";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { PRODUCT_PRINT_STATES } from "@store/shared/constants/product";
import { RoleGuard } from "@/components/auth/role-guard";
import { DetailCard } from "@/components/layout/detail-card";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useProductsQuery } from "@/hooks/use-products";
import { useSettingsQuery } from "@/hooks/use-settings";
import {
  useMarkLabelsPrintedMutation,
  useRefetchSelectedProducts,
  useSelectedProductsQueries,
} from "@/hooks/use-labels";
import { ApiError } from "@/lib/api/errors";
import {
  buildLabelLines,
  countLabels,
  expandLabels,
  gridOverflowsPage,
  hasActiveLabelFilters,
  toLabelGeometry,
  toProductListFilters,
} from "@/lib/labels";
import {
  DEFAULT_LABEL_FILTERS,
  LABEL_LIST_URL_PARAMS,
  LABEL_RUN_MAX,
  LABEL_SEARCH_DEBOUNCE_MS,
  MIN_SCANNABLE_LABEL_WIDTH_MM,
  PREVIEW_DEBOUNCE_MS,
} from "@/constants/labels";
import { LabelCategoryFilter, LabelFilterChips, LabelFilters } from "@/components/labels/label-filters";
import { LabelTable } from "@/components/labels/label-table";
import { LabelSelectBar } from "@/components/labels/label-select-bar";
import { LabelCopiesList } from "@/components/labels/label-copies-list";
import { LabelSheetCard } from "@/components/labels/label-sheet-card";
import { LabelPrintBar } from "@/components/labels/label-print-bar";
import { LabelPrintedModal } from "@/components/labels/label-printed-modal";
import { LabelPreview } from "@/components/labels/label-preview";
import { LabelPrintPortal } from "@/components/labels/label-print-portal";
import { LabelSheet } from "@/components/labels/label-sheet";
import { LabelListEmpty, LabelListError, LabelListLoading } from "@/components/labels/label-states";
import type { LabelFiltersValue, LabelListFilters, LabelStep } from "@/types/label";

// Barcode labels (rule 13): pick the pieces still owed a label, then set copies and print; the sheet comes from Settings.
function LabelsPageContent() {
  const t = useTranslations("labels");
  const locale = useLocale();
  const toast = useToast();

  const [step, setStep] = useState<LabelStep>("select");
  const [filters, setFilters] = useUrlFilters(DEFAULT_LABEL_FILTERS, LABEL_LIST_URL_PARAMS);
  const [searchInput, handleSearchChange] = useUrlSearch(
    filters.q,
    (q) => changeFilters({ q, page: DEFAULT_PAGE }),
    LABEL_SEARCH_DEBOUNCE_MS,
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Only counts the user changed; the rest follow the suggestion so none goes stale.
  const [copyOverrides, setCopyOverrides] = useState<Record<string, string>>({});
  const [printDialogClosed, setPrintDialogClosed] = useState(false);

  const list = useProductsQuery(toProductListFilters(filters));
  const settingsQuery = useSettingsQuery();
  const {
    products: selectedProducts,
    isLoading: detailsLoading,
    error: detailsError,
  } = useSelectedProductsQueries(selectedIds);
  const retryDetails = useRefetchSelectedProducts(selectedIds);
  const markPrinted = useMarkLabelsPrintedMutation();

  const products = list.data?.products ?? [];

  // Memoised down to the sheet: a run can be hundreds of labels, not rebuilt per keystroke.
  const lines = useMemo(
    () => selectedProducts.flatMap((product) => buildLabelLines(product, locale)),
    [selectedProducts, locale],
  );
  const copies = useMemo(
    () => Object.fromEntries(lines.map((line) => [line.key, copyOverrides[line.key] ?? String(line.suggestedCopies)])),
    [lines, copyOverrides],
  );

  const totalLabels = countLabels(lines, copies);
  const geometry = settingsQuery.data ? toLabelGeometry(settingsQuery.data) : null;
  const runTooLarge = totalLabels > LABEL_RUN_MAX;
  const canPrint = totalLabels > 0 && !runTooLarge;

  const items = useMemo(() => (runTooLarge ? [] : expandLabels(lines, copies)), [lines, copies, runTooLarge]);
  // The preview trails the counts so typing stays responsive on a phone.
  const previewItems = useDebouncedValue(items, PREVIEW_DEBOUNCE_MS);

  useEffect(() => {
    const handleAfterPrint = () => setPrintDialogClosed(true);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  function changeFilters(next: Partial<LabelListFilters>) {
    setFilters(next);
  }

  function toggleProduct(productId: string) {
    setSelectedIds((ids) => (ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId]));
  }

  // Selection outlives paging and filters, so the head checkbox only adds or removes this page's rows.
  function toggleAllOnPage(select: boolean) {
    const pageIds = products.map((product) => product.id);
    setSelectedIds((ids) => (select ? [...new Set([...ids, ...pageIds])] : ids.filter((id) => !pageIds.includes(id))));
  }

  function handlePrint() {
    setPrintDialogClosed(false);
    markPrinted.reset();
    window.print();
  }

  function handleMarkPrinted() {
    markPrinted.mutate(selectedIds, {
      onSuccess: () => {
        toast.success("labels.print.marked");
        setSelectedIds([]);
        setCopyOverrides({});
        setPrintDialogClosed(false);
        setStep("select");
      },
    });
  }

  const filtersValue: LabelFiltersValue = { categoryId: filters.categoryId };
  const applyFilters = (next: LabelFiltersValue) => changeFilters({ ...next, page: DEFAULT_PAGE });

  if (step === "prepare") {
    return (
      <PageContainer>
        <PageHeader
          name="labels"
          title={t("prepare.title")}
          description={t("prepare.subtitle", { products: selectedIds.length, labels: totalLabels })}
          actions={
            <Button
              variant="secondary"
              onClick={() => setStep("select")}
              data-test-selector="labels-back"
              icon={<ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />}
            >
              {t("prepare.back")}
            </Button>
          }
        />

        {detailsLoading || (!detailsError && !geometry) ? (
          <LabelListLoading />
        ) : detailsError ? (
          <LabelListError error={detailsError} onRetry={retryDetails} />
        ) : (
          geometry && (
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex flex-col gap-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1">
                <LabelSheetCard geometry={geometry} totalLabels={totalLabels} canPrint={canPrint} onPrint={handlePrint}>
                  {geometry.widthMm < MIN_SCANNABLE_LABEL_WIDTH_MM && (
                    <Alert tone="warning" data-testid="labels-small-warning">
                      {t("warnings.smallLabel", { width: MIN_SCANNABLE_LABEL_WIDTH_MM })}
                    </Alert>
                  )}
                  {gridOverflowsPage(geometry) && (
                    <Alert tone="danger" data-testid="labels-overflow-warning">
                      {t("warnings.gridOverflow")}
                    </Alert>
                  )}
                </LabelSheetCard>
              </div>

              <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
                <DetailCard icon={Tags} title={t("copies.title")} data-testid="labels-copies-card">
                  <LabelCopiesList
                    lines={lines}
                    copies={copies}
                    onChange={(key, value) => setCopyOverrides((prev) => ({ ...prev, [key]: value }))}
                  />
                  {runTooLarge && (
                    <Alert tone="danger" data-testid="labels-too-many">
                      {t("warnings.tooManyLabels", { max: LABEL_RUN_MAX })}
                    </Alert>
                  )}
                  {totalLabels === 0 && (
                    <Alert tone="info" data-testid="labels-none">
                      {t("warnings.noLabels")}
                    </Alert>
                  )}
                </DetailCard>

                {canPrint && (
                  <DetailCard icon={Eye} title={t("preview.title")} data-testid="labels-preview-card">
                    <LabelPreview items={previewItems} geometry={geometry} />
                  </DetailCard>
                )}
              </div>
            </div>
          )
        )}

        {/* What the browser prints, outside the app layout so nothing can clip a label. */}
        {geometry && canPrint && (
          <LabelPrintPortal geometry={geometry}>
            <LabelSheet items={items} geometry={geometry} />
          </LabelPrintPortal>
        )}

        <LabelPrintBar totalLabels={totalLabels} canPrint={canPrint} onPrint={handlePrint} />

        <LabelPrintedModal
          open={printDialogClosed}
          isPending={markPrinted.isPending}
          errorCode={
            markPrinted.isError
              ? markPrinted.error instanceof ApiError
                ? markPrinted.error.code
                : ERROR_CODES.INTERNAL
              : null
          }
          onConfirm={handleMarkPrinted}
          onClose={() => setPrintDialogClosed(false)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader name="labels" title={t("title")} description={t("subtitle")} />

      <div className="flex flex-col gap-4">
        {/* Which labels are still owed is this screen's question, so it is one tap away rather than in the drawer. */}
        <SegmentedControl
          data-testid="labels-print-state"
          label={t("filters.printState")}
          value={filters.printState}
          onChange={(printState) => changeFilters({ printState, page: DEFAULT_PAGE })}
          options={PRODUCT_PRINT_STATES.map((state) => ({ value: state, label: t(`filters.${state}`) }))}
        />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-64 flex-1 sm:max-w-md">
              <SearchField
                data-testid="labels-search"
                label={t("search.label")}
                value={searchInput}
                onChange={(event) => handleSearchChange(event.target.value)}
                onClear={() => handleSearchChange("")}
                clearLabel={t("search.clear")}
                placeholder={t("search.placeholder")}
              />
            </div>
            <LabelCategoryFilter
              value={filters.categoryId}
              onChange={(categoryId) => changeFilters({ categoryId, page: DEFAULT_PAGE })}
            />
            <LabelFilters value={filtersValue} onApply={applyFilters} />
            {list.data?.meta && (
              <div className="ms-auto flex h-(--control-h) items-center">
                <TotalBadge data-testid="labels-count" total={list.data.meta.total} />
              </div>
            )}
          </div>
          <LabelFilterChips value={filtersValue} onChange={applyFilters} />
        </div>

        {list.isError ? (
          <LabelListError error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.isLoading && products.length === 0 ? (
          <LabelListEmpty hasFilters={hasActiveLabelFilters(filters)} />
        ) : (
          <LabelTable
            products={products}
            meta={list.data?.meta ?? null}
            isLoading={list.isLoading}
            isRefreshing={list.isFetching && !list.isLoading}
            selectedIds={selectedIds}
            onToggle={toggleProduct}
            onToggleAll={toggleAllOnPage}
            onPageChange={(page) => changeFilters({ page })}
            onPageSizeChange={(pageSize) => changeFilters({ pageSize, page: DEFAULT_PAGE })}
          />
        )}

        <LabelSelectBar
          count={selectedIds.length}
          onClear={() => setSelectedIds([])}
          onNext={() => setStep("prepare")}
        />
      </div>
    </PageContainer>
  );
}

export default function LabelsPage() {
  return (
    <RoleGuard action="product.printLabels">
      <LabelsPageContent />
    </RoleGuard>
  );
}
