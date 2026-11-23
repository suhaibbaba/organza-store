"use client";

import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";
import { Alert, Button, Textarea, Typography, useToast } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { ERROR_CODES } from "@store/shared/constants/errors";
import type { ExchangeSettlement, Order } from "@store/shared/types/order";
import type { Product, ProductSummary } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";
import type { ExchangeOrderInput } from "@store/shared/schemas/order";
import { DEFAULT_CUSTOMER_PAYS_SETTLEMENT, DEFAULT_SHOP_PAYS_SETTLEMENT } from "@/constants/orders";
import { PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { fetchProduct } from "@/lib/api/products";
import { ApiError } from "@/lib/api/errors";
import { localize } from "@/lib/i18n-content";
import { lineGrossCents, toOrderItems } from "@/lib/order-draft";
import { fromCents } from "@/lib/money";
import { exchangeDifferenceCents, exchangeSide, settlementFor, toReturnItems } from "@/lib/order-exchange";
import { useOrderDraft } from "@/hooks/use-order-draft";
import { useExchangeOrderMutation, useExchangePreviewQuery } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "@/components/providers/session-provider";
import { ProductPicker } from "@/components/orders/new/product-picker";
import { VariantPickerSheet } from "@/components/orders/new/variant-picker-sheet";
import { DraftLinesList } from "@/components/orders/new/draft-lines-list";
import { DraftTotalsCard } from "@/components/orders/new/draft-totals-card";
import { OrderDiscountSheet } from "@/components/orders/new/order-discount-sheet";
import { OrderFormSection } from "@/components/orders/new/order-form-section";
import { ExchangeReturningList } from "@/components/orders/exchange/exchange-returning-list";
import { ExchangeSettlementFields } from "@/components/orders/exchange/exchange-settlement";
import type { Customer } from "@/types/customer";
import type { ReturnQuantities } from "@/types/order";

// One screen for staff: what came back, what goes out, and how the difference was settled (spec.md "Exchanges").
export function ExchangeBuilder({ order }: { order: Order }) {
  const t = useTranslations("orders.exchange");
  const tNew = useTranslations("orders.new");
  const locale = useLocale();
  const translateError = useTranslateError();
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();

  const draft = useOrderDraft();
  const mutation = useExchangeOrderMutation(order.id);

  const [quantities, setQuantities] = useState<ReturnQuantities>({});
  const [query, setQuery] = useState("");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [lookupErrorCode, setLookupErrorCode] = useState<string | null>(null);
  const [discountLineKey, setDiscountLineKey] = useState<string | null>(null);
  const [orderDiscountOpen, setOrderDiscountOpen] = useState(false);
  const [customerPays, setCustomerPays] = useState<ExchangeSettlement>(DEFAULT_CUSTOMER_PAYS_SETTLEMENT);
  const [shopPays, setShopPays] = useState<ExchangeSettlement>(DEFAULT_SHOP_PAYS_SETTLEMENT);
  const [debtCustomer, setDebtCustomer] = useState<Customer | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const returnItems = useMemo(() => toReturnItems(quantities), [quantities]);
  const preview = useExchangePreviewQuery(order.id, returnItems);
  const credit = returnItems.length > 0 ? (preview.data?.credit ?? null) : null;

  const differenceCents = exchangeDifferenceCents(draft.totals.total, credit ?? "0");
  const side = exchangeSide(differenceCents);
  const settlement = settlementFor(side, customerPays, shopPays);
  const canDebt = can(user, "order.sellOnCredit");
  const needsDebtCustomer = settlement === "DEBT" && !order.customerId && !debtCustomer;

  const addItem = useCallback(
    (product: Product, variant: Variant | null) => {
      draft.addItem(product, variant);
      setQuery("");
    },
    [draft],
  );

  // The list DTO carries no variants, so the full product is fetched before deciding whether to ask which one.
  const selectSearchResult = useCallback(
    async (summary: ProductSummary) => {
      setPendingProductId(summary.id);
      setLookupErrorCode(null);
      try {
        const product = await queryClient.fetchQuery({
          queryKey: [PRODUCT_LIST_QUERY_KEY, summary.id],
          queryFn: () => fetchProduct(summary.id),
        });
        if (product.hasVariants) {
          setPickerProduct(product);
        } else {
          addItem(product, null);
        }
      } catch (error) {
        setLookupErrorCode(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL);
      } finally {
        setPendingProductId(null);
      }
    },
    [addItem, queryClient],
  );

  function setSettlement(next: ExchangeSettlement) {
    if (side === "customer") {
      setCustomerPays(next);
    } else {
      setShopPays(next);
    }
  }

  function submit() {
    setSubmitted(true);
    if (returnItems.length === 0 || draft.isEmpty || credit === null || needsDebtCustomer) {
      return;
    }
    const trimmedNote = note.trim();
    const input: ExchangeOrderInput = {
      returnItems,
      items: toOrderItems(draft.lines),
      settlement,
      ...(settlement === "DEBT" && debtCustomer ? { customerId: debtCustomer.id } : {}),
      ...(trimmedNote ? { note: trimmedNote } : {}),
      ...(draft.orderDiscount.type && draft.orderDiscount.value
        ? { discountType: draft.orderDiscount.type, discountValue: draft.orderDiscount.value }
        : {}),
    };
    mutation.mutate(input, {
      onSuccess: (created) => {
        toast.success("orders.exchange.done", { number: created.orderNumber });
        router.push(`/orders/${created.id}`);
      },
    });
  }

  const discountLine = draft.lines.find((line) => line.key === discountLineKey) ?? null;
  const missingReturn = submitted && returnItems.length === 0;
  const missingNew = submitted && draft.isEmpty;

  return (
    <>
      <div className="flex flex-col gap-5">
        {mutation.isError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}
        {preview.isError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(preview.error instanceof ApiError ? preview.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <OrderFormSection name="returning" forceOpen={missingReturn}>
              <div className="flex flex-col gap-2">
                <ExchangeReturningList
                  items={order.items}
                  quantities={quantities}
                  onChange={(itemId, quantity) => setQuantities((current) => ({ ...current, [itemId]: quantity }))}
                />
                {missingReturn && (
                  <Typography variant="caption" tone="error" role="alert" data-test-selector="exchange-error-returning">
                    {t("needReturning")}
                  </Typography>
                )}
              </div>
            </OrderFormSection>

            <OrderFormSection name="products" forceOpen={missingNew}>
              <div className="flex flex-col gap-3">
                <ProductPicker
                  query={query}
                  onQueryChange={setQuery}
                  pendingId={pendingProductId}
                  onSelect={(summary) => void selectSearchResult(summary)}
                />
                {lookupErrorCode && (
                  <Alert tone="danger" data-testid="alert-destructive">
                    {translateError(lookupErrorCode)}
                  </Alert>
                )}
                <DraftLinesList draft={draft} isGift={false} onLineDiscountClick={setDiscountLineKey} />
                {missingNew && (
                  <Typography variant="caption" tone="error" role="alert" data-test-selector="exchange-error-new">
                    {t("needNew")}
                  </Typography>
                )}
              </div>
            </OrderFormSection>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <OrderFormSection name="summary">
              <DraftTotalsCard
                totals={draft.totals}
                isGift={false}
                orderDiscount={draft.orderDiscount}
                onOrderDiscountClick={() => setOrderDiscountOpen(true)}
              />
            </OrderFormSection>

            <OrderFormSection name="settlement" forceOpen={submitted && needsDebtCustomer}>
              <ExchangeSettlementFields
                credit={credit}
                isCreditLoading={returnItems.length > 0 && preview.isFetching}
                newTotal={draft.totals.total}
                differenceCents={differenceCents}
                side={side}
                settlement={settlement}
                onSettlementChange={setSettlement}
                canDebt={canDebt}
                originalCustomerName={order.customerId ? order.customerName : null}
                debtCustomer={debtCustomer}
                onDebtCustomerChange={setDebtCustomer}
                showErrors={submitted}
              />
            </OrderFormSection>

            <OrderFormSection name="note">
              <Textarea
                id="exchange-note"
                aria-label={tNew("sections.note.title")}
                data-test-selector={fieldTestSelector("exchange-note")}
                rows={3}
                placeholder={t("notePlaceholder")}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </OrderFormSection>

            <Button
              type="button"
              data-test-selector="exchange-submit"
              isLoading={mutation.isPending}
              disabled={preview.isFetching}
              onClick={submit}
              icon={<ArrowLeftRight className="size-4" aria-hidden="true" />}
            >
              {t("confirm")}
            </Button>
          </div>
        </div>
      </div>

      <VariantPickerSheet
        product={pickerProduct}
        onOpenChange={(open) => {
          if (!open) {
            setPickerProduct(null);
          }
        }}
        onPick={addItem}
      />

      {discountLine && (
        <OrderDiscountSheet
          open
          onOpenChange={(open) => {
            if (!open) {
              setDiscountLineKey(null);
            }
          }}
          title={localize(discountLine.name, locale)}
          baseAmount={fromCents(lineGrossCents(discountLine))}
          current={{ type: discountLine.discountType, value: discountLine.discountValue }}
          onApply={(type, value) => draft.setLineDiscount(discountLine.key, type, value)}
        />
      )}

      <OrderDiscountSheet
        open={orderDiscountOpen}
        onOpenChange={setOrderDiscountOpen}
        title={tNew("wholeOrder")}
        baseAmount={draft.totals.subtotal}
        current={draft.orderDiscount}
        onApply={draft.setOrderDiscount}
      />
    </>
  );
}
