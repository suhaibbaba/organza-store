"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { SALE_ORDER_TYPE } from "@organza/shared/constants/order";
import type { Order } from "@organza/shared/types/order";
import type { Product, ProductSummary } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import type { CreateOrderInput } from "@organza/shared/schemas/order";
import { MANUAL_ORDER_CHANNEL, MANUAL_ORDER_PAYMENT_METHOD } from "@/constants/orders";
import { PRODUCT_LIST_QUERY_KEY } from "@/constants/products";
import { fetchProduct } from "@/lib/api/products";
import { ApiError } from "@/lib/api/errors";
import { localize } from "@/lib/i18n-content";
import { lineGrossCents, toCustomerFields, toOrderItems } from "@/lib/order-draft";
import { fromCents } from "@/lib/money";
import {
  DEFAULT_ORDER_CUSTOMER_VALUES,
  orderCustomerFormSchema,
  toCustomerDraft,
  type OrderCustomerFormValues,
} from "@/lib/validation/order-form";
import { useOrderDraft } from "@/hooks/use-order-draft";
import { useCreateOrderMutation } from "@/hooks/use-orders";
import { useTranslateError } from "@/hooks/use-translate-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { OrderChannelBadge } from "@/components/orders/order-channel-badge";
import { ProductPicker } from "@/components/orders/new/product-picker";
import { VariantPickerSheet } from "@/components/orders/new/variant-picker-sheet";
import { DraftLinesList } from "@/components/orders/new/draft-lines-list";
import { DraftTotalsCard } from "@/components/orders/new/draft-totals-card";
import { OrderDiscountSheet } from "@/components/orders/new/order-discount-sheet";
import { CustomerForm } from "@/components/orders/new/customer-form";
import { OrderCreated } from "@/components/orders/new/order-created";

// Writing down an order that came in over WhatsApp. One screen, top to
// bottom: what they want, who they are, what it comes to, save — no wizard to
// get lost in (CLAUDE.md "Few, clear steps").
//
// The order is filed under the WHATSAPP channel and opens NEW with no stock
// taken off the shelf; it commits when someone starts preparing it (spec.md
// "Stock deduction").
export function OrderBuilder() {
  const t = useTranslations("orders.new");
  const locale = useLocale();
  const translateError = useTranslateError();
  const queryClient = useQueryClient();

  const draft = useOrderDraft();
  const mutation = useCreateOrderMutation();

  const [query, setQuery] = useState("");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [lookupErrorCode, setLookupErrorCode] = useState<string | null>(null);
  const [discountLineKey, setDiscountLineKey] = useState<string | null>(null);
  const [orderDiscountOpen, setOrderDiscountOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OrderCustomerFormValues>({
    resolver: zodResolver(orderCustomerFormSchema),
    defaultValues: DEFAULT_ORDER_CUSTOMER_VALUES,
  });

  const addItem = useCallback(
    (product: Product, variant: Variant | null) => {
      draft.addItem(product, variant);
      // Clearing the box readies it for the next item — the line appearing
      // below is the confirmation that it landed.
      setQuery("");
    },
    [draft]
  );

  // A tapped search result: the list DTO carries no variants, so the full
  // product is fetched before deciding whether to ask which one.
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
    [addItem, queryClient]
  );

  function onSubmit(values: OrderCustomerFormValues) {
    if (draft.isEmpty) return;

    const input: CreateOrderInput = {
      channel: MANUAL_ORDER_CHANNEL,
      // Money in. Giving stock away is a GIFT order, rung up at the POS by
      // an Admin/Manager — never something this form can produce.
      type: SALE_ORDER_TYPE,
      paymentMethod: MANUAL_ORDER_PAYMENT_METHOD,
      items: toOrderItems(draft.lines),
      ...toCustomerFields(toCustomerDraft(values)),
      ...(draft.orderDiscount.type && draft.orderDiscount.value
        ? { discountType: draft.orderDiscount.type, discountValue: draft.orderDiscount.value }
        : {}),
    };

    mutation.mutate(input, { onSuccess: setCreatedOrder });
  }

  function startNewOrder() {
    setCreatedOrder(null);
    draft.clear();
    reset(DEFAULT_ORDER_CUSTOMER_VALUES);
    setQuery("");
    mutation.reset();
  }

  const discountLine = draft.lines.find((line) => line.key === discountLineKey) ?? null;

  // A saved order takes over the screen — nothing else on it is worth looking
  // at until the next one is started.
  if (createdOrder) {
    return <OrderCreated order={createdOrder} onNewOrder={startNewOrder} />;
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">{t("itemsTitle")}</h2>
            <OrderChannelBadge channel={MANUAL_ORDER_CHANNEL} />
          </div>

          <ProductPicker
            query={query}
            onQueryChange={setQuery}
            pendingId={pendingProductId}
            onSelect={(summary) => void selectSearchResult(summary)}
          />

          {lookupErrorCode && <Alert variant="destructive">{translateError(lookupErrorCode)}</Alert>}

          <DraftLinesList draft={draft} onLineDiscountClick={setDiscountLineKey} />
        </div>

        <CustomerForm register={register} control={control} setValue={setValue} errors={errors} />

        <DraftTotalsCard
          totals={draft.totals}
          orderDiscount={draft.orderDiscount}
          onOrderDiscountClick={() => setOrderDiscountOpen(true)}
        />

        {/* An order with no lines is the one failure the form itself can't
            express — the customer fields may all be perfect. */}
        {draft.isEmpty && <Alert>{t("needItems")}</Alert>}

        {mutation.isError && (
          <Alert variant="destructive">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}

        <Button type="submit" className="h-14 w-full text-base sm:w-auto sm:self-start" disabled={mutation.isPending || draft.isEmpty}>
          {mutation.isPending ? <Spinner /> : <Save className="size-5" aria-hidden="true" />}
          {mutation.isPending ? t("saving") : t("save")}
        </Button>
      </form>

      <VariantPickerSheet
        product={pickerProduct}
        onOpenChange={(open) => {
          if (!open) setPickerProduct(null);
        }}
        onPick={addItem}
      />

      {discountLine && (
        <OrderDiscountSheet
          open
          onOpenChange={(open) => {
            if (!open) setDiscountLineKey(null);
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
        title={t("wholeOrder")}
        baseAmount={draft.totals.subtotal}
        current={draft.orderDiscount}
        onApply={draft.setOrderDiscount}
      />
    </>
  );
}
