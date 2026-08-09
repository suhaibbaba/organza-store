"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Printer, TriangleAlert } from "lucide-react";
import { can } from "@shared/lib/permissions";
import { DEFAULT_PAGE } from "@shared/constants/pagination";
import type { ProductPrintState } from "@shared/types/product";
import { Link } from "@/i18n/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/components/providers/session-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useProductsQuery } from "@/hooks/use-products";
import { useSettingsQuery } from "@/hooks/use-settings";
import {
  useMarkLabelsPrintedMutation,
  useRefetchSelectedProducts,
  useSelectedProductsQueries,
} from "@/hooks/use-labels";
import { useTranslateError } from "@/hooks/use-translate-error";
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
  LABEL_RUN_MAX,
  LABEL_SEARCH_DEBOUNCE_MS,
  MIN_SCANNABLE_LABEL_WIDTH_MM,
  PREVIEW_DEBOUNCE_MS,
} from "@/constants/labels";
import { ProductSearch } from "@/components/products/product-search";
import { ProductPagination } from "@/components/products/product-pagination";
import { LabelFilters } from "@/components/labels/label-filters";
import { LabelProductRow } from "@/components/labels/label-product-row";
import { LabelCopiesList } from "@/components/labels/label-copies-list";
import { LabelPreview } from "@/components/labels/label-preview";
import { LabelPrintPortal } from "@/components/labels/label-print-portal";
import { LabelSheet } from "@/components/labels/label-sheet";
import {
  LabelListEmpty,
  LabelListError,
  LabelListLoading,
  LabelListSpinnerOverlay,
} from "@/components/labels/label-states";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { LabelListFilters, LabelStep } from "@/types/label";

// Barcode labels (CLAUDE.md rule 13: the store generates its own barcodes, so
// every piece needs a printed label before it can go on the shelf).
//
// Two steps, because that is how the job is actually done: pick the pieces
// whose labels are still owed, then set how many of each and print. The
// sheet itself is described entirely by the Setting singleton, so the same
// screen drives a thermal roll printer or an A4 sticker sheet.

function LabelsPageContent() {
  const t = useTranslations("labels");
  const locale = useLocale();
  const translateError = useTranslateError();
  const { user } = useSession();

  const [step, setStep] = useState<LabelStep>("select");
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<LabelListFilters>(DEFAULT_LABEL_FILTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Only the counts the user actually changed. Everything else falls back to
  // the suggestion, so a selection change can never strand a stale number.
  const [copyOverrides, setCopyOverrides] = useState<Record<string, string>>({});
  // Set when the browser's print dialog closes. The browser never tells us
  // whether anything came out of the printer, so we ask instead of guessing.
  const [printDialogClosed, setPrintDialogClosed] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput, LABEL_SEARCH_DEBOUNCE_MS);
  const effectiveFilters = useMemo<LabelListFilters>(
    () => ({ ...filters, q: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const list = useProductsQuery(toProductListFilters(effectiveFilters));
  const settingsQuery = useSettingsQuery();
  const { products: selectedProducts, isLoading: detailsLoading, error: detailsError } =
    useSelectedProductsQueries(selectedIds);
  const retryDetails = useRefetchSelectedProducts(selectedIds);
  const markPrinted = useMarkLabelsPrintedMutation();

  const products = list.data?.products ?? [];
  const selectedSet = new Set(selectedIds);

  // One line per thing that gets its own sticker. Held in memos all the way
  // down to the sheet: a print run can be hundreds of labels, and it must not
  // be rebuilt on every keystroke in a copies field.
  const lines = useMemo(
    () => selectedProducts.flatMap((product) => buildLabelLines(product, locale)),
    [selectedProducts, locale]
  );

  // Suggested counts, with the user's own edits layered on top.
  const copies = useMemo(
    () => Object.fromEntries(lines.map((line) => [line.key, copyOverrides[line.key] ?? String(line.suggestedCopies)])),
    [lines, copyOverrides]
  );

  const totalLabels = countLabels(lines, copies);
  const geometry = settingsQuery.data ? toLabelGeometry(settingsQuery.data) : null;
  const runTooLarge = totalLabels > LABEL_RUN_MAX;

  const items = useMemo(() => (runTooLarge ? [] : expandLabels(lines, copies)), [lines, copies, runTooLarge]);
  // The preview redraws a whole sheet; letting it trail the input by a moment
  // keeps typing a count responsive on a phone.
  const previewItems = useDebouncedValue(items, PREVIEW_DEBOUNCE_MS);

  useEffect(() => {
    const handleAfterPrint = () => setPrintDialogClosed(true);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  function toggleProduct(productId: string, selected: boolean) {
    setSelectedIds((ids) => (selected ? [...new Set([...ids, productId])] : ids.filter((id) => id !== productId)));
  }

  function selectAllOnPage() {
    setSelectedIds((ids) => [...new Set([...ids, ...products.map((product) => product.id)])]);
  }

  function updatePage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    setFilters((f) => ({ ...f, page: DEFAULT_PAGE }));
  }

  function handlePrintStateChange(printState: ProductPrintState) {
    setFilters((f) => ({ ...f, printState, page: DEFAULT_PAGE }));
  }

  function handleCategoryChange(categoryId: string | null) {
    setFilters((f) => ({ ...f, categoryId, page: DEFAULT_PAGE }));
  }

  function handlePrint() {
    setPrintDialogClosed(false);
    markPrinted.reset();
    window.print();
  }

  function handleMarkPrinted() {
    markPrinted.mutate(selectedIds, {
      onSuccess: () => {
        // Back to a clean slate: the products just printed drop out of the
        // "not printed yet" list on the refetch the mutation triggers.
        setSelectedIds([]);
        setCopyOverrides({});
        setPrintDialogClosed(false);
        setStep("select");
      },
    });
  }

  const hasFilters = hasActiveLabelFilters(effectiveFilters);

  // ---- Step 2: counts, preview, print ------------------------------------
  if (step === "prepare") {
    return (
      <PageContainer>
        {/* Above the header, not inside it: this steps back through the
            screen's own two stages rather than acting on it. */}
        <div className="mb-4 flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep("select")}>
            <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            {t("prepare.back")}
          </Button>
        </div>

        <PageHeader
          title={t("prepare.title")}
          description={t("prepare.subtitle", { products: selectedIds.length, labels: totalLabels })}
        />

        <div className="flex flex-col gap-4">
          {markPrinted.isSuccess && (
            <Alert variant="success">
              <p>{t("print.marked")}</p>
            </Alert>
          )}

          {printDialogClosed && !markPrinted.isSuccess && (
            <Alert className="flex-col items-stretch gap-3">
              <div>
                <p className="font-medium">{t("print.confirmTitle")}</p>
                <p className="mt-1 text-muted-foreground">{t("print.confirmDescription")}</p>
              </div>
              {markPrinted.isError && (
                <p className="text-destructive">
                  {translateError(markPrinted.error instanceof ApiError ? markPrinted.error.code : "error.internal")}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" onClick={handleMarkPrinted} disabled={markPrinted.isPending}>
                  {markPrinted.isPending ? <Spinner className="size-4" /> : null}
                  {t("print.confirmYes")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setPrintDialogClosed(false)}>
                  {t("print.confirmNo")}
                </Button>
              </div>
            </Alert>
          )}

          {detailsLoading ? (
            <LabelListLoading />
          ) : detailsError ? (
            <LabelListError error={detailsError} onRetry={retryDetails} />
          ) : !geometry ? (
            <LabelListLoading />
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-sm font-medium text-foreground">{t("sheet.title")}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {geometry.printMode === "A4_GRID"
                    ? t("sheet.a4", {
                        width: geometry.widthMm,
                        height: geometry.heightMm,
                        columns: geometry.columns,
                        rows: geometry.rows,
                      })
                    : t("sheet.thermal", { width: geometry.widthMm, height: geometry.heightMm })}
                </p>
                {can(user, "settings.manage") && (
                  <Link href="/settings" className="mt-2 inline-block text-sm font-medium text-primary underline">
                    {t("sheet.change")}
                  </Link>
                )}
              </div>

              {geometry.widthMm < MIN_SCANNABLE_LABEL_WIDTH_MM && (
                <Alert>
                  <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
                  <p>{t("warnings.smallLabel", { width: MIN_SCANNABLE_LABEL_WIDTH_MM })}</p>
                </Alert>
              )}

              {gridOverflowsPage(geometry) && (
                <Alert variant="destructive">
                  <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
                  <p>{t("warnings.gridOverflow")}</p>
                </Alert>
              )}

              <LabelCopiesList
                lines={lines}
                copies={copies}
                onChange={(key, value) => setCopyOverrides((prev) => ({ ...prev, [key]: value }))}
              />

              {runTooLarge ? (
                <Alert variant="destructive">
                  <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
                  <p>{t("warnings.tooManyLabels", { max: LABEL_RUN_MAX })}</p>
                </Alert>
              ) : totalLabels === 0 ? (
                <Alert>
                  <p>{t("warnings.noLabels")}</p>
                </Alert>
              ) : (
                <>
                  <LabelPreview items={previewItems} geometry={geometry} />
                  {/* The copy the browser prints — same component, same props,
                      rendered outside the app layout so nothing around it can
                      shift or clip a label. */}
                  <LabelPrintPortal geometry={geometry}>
                    <LabelSheet items={items} geometry={geometry} />
                  </LabelPrintPortal>
                </>
              )}

              <div className="sticky bottom-[var(--bottom-bar-inset)] z-20 -mx-4 border-t border-border bg-background px-4 py-3 md:mx-0 md:rounded-xl md:border">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{t("prepare.totalLabels", { count: totalLabels })}</span>
                  <Button type="button" onClick={handlePrint} disabled={totalLabels === 0 || runTooLarge}>
                    <Printer className="size-5" aria-hidden="true" />
                    {t("prepare.print")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </PageContainer>
    );
  }

  // ---- Step 1: pick the products ------------------------------------------
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="flex flex-col gap-4">
        {markPrinted.isSuccess && (
          <Alert variant="success">
            <p>{t("print.marked")}</p>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <ProductSearch value={searchInput} onChange={handleSearchChange} />
          <LabelFilters
            printState={filters.printState}
            categoryId={filters.categoryId}
            onPrintStateChange={handlePrintStateChange}
            onCategoryChange={handleCategoryChange}
          />
        </div>

        {list.isLoading ? (
          <LabelListLoading />
        ) : list.isError ? (
          <LabelListError error={list.error} onRetry={() => void list.refetch()} />
        ) : products.length === 0 ? (
          <LabelListEmpty hasFilters={hasFilters} />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" size="sm" onClick={selectAllOnPage}>
                {t("selectAll")}
              </Button>
              {selectedIds.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                  {t("clearSelection")}
                </Button>
              )}
            </div>

            {list.isFetching && <LabelListSpinnerOverlay />}

            <div className="flex flex-col gap-3">
              {products.map((product) => (
                <LabelProductRow
                  key={product.id}
                  product={product}
                  selected={selectedSet.has(product.id)}
                  onToggle={toggleProduct}
                />
              ))}
            </div>

            {list.data?.meta && <ProductPagination meta={list.data.meta} onPageChange={updatePage} />}
          </>
        )}

        <div className="sticky bottom-[var(--bottom-bar-inset)] z-20 -mx-4 border-t border-border bg-background px-4 py-3 md:mx-0 md:rounded-xl md:border">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t("selectedCount", { count: selectedIds.length })}</span>
            <Button type="button" onClick={() => setStep("prepare")} disabled={selectedIds.length === 0}>
              {t("next")}
              <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          </div>
        </div>

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
