"use client";

import { useCallback, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Textarea, Typography } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { GIFT_ORDER_TYPE, ONLINE_ORDER_CHANNELS, SALE_ORDER_TYPE } from "@store/shared/constants/order";
import type { Order } from "@store/shared/types/order";
import type { Product, ProductSummary } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";
import type { CreateOrderInput } from "@store/shared/schemas/order";
import { MANUAL_ORDER_PAYMENT_METHOD } from "@/constants/orders";
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
import { useSession } from "@/components/providers/session-provider";
import { ProductPicker } from "@/components/orders/new/product-picker";
import { VariantPickerSheet } from "@/components/orders/new/variant-picker-sheet";
import { DraftLinesList } from "@/components/orders/new/draft-lines-list";
import { DraftTotalsCard } from "@/components/orders/new/draft-totals-card";
import { OrderDiscountSheet } from "@/components/orders/new/order-discount-sheet";
import { CustomerForm } from "@/components/orders/new/customer-form";
import { OrderCreated } from "@/components/orders/new/order-created";
import { OrderFormSection } from "@/components/orders/new/order-form-section";
import { OrderKindFields } from "@/components/orders/new/order-kind-fields";

// WhatsApp opens NEW (stock taken at preparation); an in-shop order opens finished with its stock taken (spec.md "Stock deduction").
export function OrderBuilder() {
  const t = useTranslations("orders.new");
  const locale = useLocale();
  const translateError = useTranslateError();
  const queryClient = useQueryClient();
  const { user } = useSession();

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

  const channel = useWatch({ control, name: "channel" });
  // An Employee may not give stock away (order.createGift); the backend refuses it regardless.
  const canGift = can(user, "order.createGift");
  const isGift = useWatch({ control, name: "gift" }) && canGift;
  const needsContact = (ONLINE_ORDER_CHANNELS as readonly string[]).includes(channel);

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

  function onSubmit(values: OrderCustomerFormValues) {
    if (draft.isEmpty) {
      return;
    }

    const customer = toCustomerDraft(values);
    const note = customer.note.trim();
    // A gift is priced at zero on the server, so a discount would describe money that never existed.
    const gift = values.gift && canGift;
    const lines = gift
      ? draft.lines.map((line) => ({ ...line, discountType: null, discountValue: null }))
      : draft.lines;

    const input: CreateOrderInput = {
      channel: values.channel,
      type: gift ? GIFT_ORDER_TYPE : SALE_ORDER_TYPE,
      paymentMethod: MANUAL_ORDER_PAYMENT_METHOD,
      items: toOrderItems(lines),
      ...(needsContact ? toCustomerFields(customer) : note ? { note } : {}),
      ...(!gift && draft.orderDiscount.type && draft.orderDiscount.value
        ? { discountType: draft.orderDiscount.type, discountValue: draft.orderDiscount.value }
        : {}),
    };

    mutation.mutate(input, { onSuccess: setCreatedOrder });
  }

  function startNewOrder() {
    setCreatedOrder(null);
    draft.clear();
    reset({ ...DEFAULT_ORDER_CUSTOMER_VALUES, channel });
    setQuery("");
    mutation.reset();
  }

  const discountLine = draft.lines.find((line) => line.key === discountLineKey) ?? null;

  if (createdOrder) {
    return <OrderCreated order={createdOrder} onNewOrder={startNewOrder} />;
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {mutation.isError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : ERROR_CODES.INTERNAL)}
          </Alert>
        )}

        {/* Phones see the order type first, since it decides whether the customer fields apply at all. */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr]">
          <div className="min-w-0 lg:col-start-2 lg:row-start-1">
            <OrderFormSection name="kind">
              <OrderKindFields control={control} channel={channel} isGift={isGift} canGift={canGift} />
            </OrderFormSection>
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <OrderFormSection name="products">
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

                <DraftLinesList draft={draft} isGift={isGift} onLineDiscountClick={setDiscountLineKey} />
              </div>
            </OrderFormSection>

            {needsContact && (
              <OrderFormSection name="customer" forceOpen={Object.keys(errors).length > 0}>
                <CustomerForm register={register} control={control} setValue={setValue} errors={errors} />
              </OrderFormSection>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-2">
            <OrderFormSection name="summary">
              <DraftTotalsCard
                totals={draft.totals}
                isGift={isGift}
                orderDiscount={draft.orderDiscount}
                onOrderDiscountClick={() => setOrderDiscountOpen(true)}
              />
            </OrderFormSection>

            <OrderFormSection name="note">
              <Textarea
                id="customer-note"
                aria-label={t("sections.note.title")}
                data-test-selector={fieldTestSelector("customer-note")}
                rows={3}
                placeholder={t("customer.notePlaceholder")}
                {...register("note")}
              />
            </OrderFormSection>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                data-test-selector="order-create-submit"
                isLoading={mutation.isPending}
                disabled={draft.isEmpty}
              >
                {t("save")}
              </Button>
              {draft.isEmpty && (
                <Typography variant="caption" tone="muted" as="p">
                  {t("needItems")}
                </Typography>
              )}
            </div>
          </div>
        </div>
      </form>

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
        title={t("wholeOrder")}
        baseAmount={draft.totals.subtotal}
        current={draft.orderDiscount}
        onApply={draft.setOrderDiscount}
      />
    </>
  );
}
