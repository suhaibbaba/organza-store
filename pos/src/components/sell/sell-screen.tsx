"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { can } from "@shared/lib/permissions";
import { ERROR_CODES } from "@shared/constants/errors";
import type { Order } from "@shared/types/order";
import type { Product, ProductSummary } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import { PRODUCT_DETAIL_QUERY_KEY } from "@/constants/api";
import { ApiError } from "@/lib/api/errors";
import { fetchProduct } from "@/lib/api/products";
import { localize } from "@/lib/i18n-content";
import { useSession } from "@/components/providers/session-provider";
import { useCart } from "@/hooks/use-cart";
import { useAddByCode, type CodeOutcome } from "@/hooks/use-add-by-code";
import { useCheckout } from "@/hooks/use-checkout";
import { useProductSearch } from "@/hooks/use-product-search";
import { useTransientMessage } from "@/hooks/use-transient-message";
import { useTranslateError } from "@/hooks/use-translate-error";
import { SearchBar } from "@/components/sell/search-bar";
import { SearchResults } from "@/components/sell/search-results";
import { CartPanel } from "@/components/sell/cart-panel";
import { CheckoutBar } from "@/components/sell/checkout-bar";
import { DiscountSheet } from "@/components/sell/discount-sheet";
import { SaleSuccess } from "@/components/sell/sale-success";
import { ScannerSheet } from "@/components/sell/scanner/scanner-sheet";
import { VariantPickerSheet } from "@/components/sell/variant-picker-sheet";
import { Alert } from "@/components/ui/alert";
import { lineGrossCents } from "@/lib/cart";
import { fromCents } from "@/lib/money";

// The selling screen. One screen, one job: get what the customer is holding
// into the cart and take the money, in as few taps as possible.
//
// Three ways in, in the order they're reached for at a counter: the camera
// (scan the tag), the search box (when the tag is unreadable), and typing a
// number (numbered shawls — see VariantPickerSheet). All three funnel into
// the same cart.
export function SellScreen() {
  const t = useTranslations("sell");
  const locale = useLocale();
  const translateError = useTranslateError();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const cart = useCart();
  const checkout = useCheckout();
  const { message, show, clear: clearMessage } = useTransientMessage();

  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [discountLineKey, setDiscountLineKey] = useState<string | null>(null);
  const [orderDiscountOpen, setOrderDiscountOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const search = useProductSearch(query);
  const isSearching = query.trim().length > 0;

  // Every staff role can sell, Employee included (spec.md "Roles &
  // Permissions"). Checked here so an account that somehow lacks it sees a
  // plain explanation instead of a screen whose buttons all fail — the real
  // gate is the backend's, on every request (CLAUDE.md rule 5).
  const canSell = can(user, "order.create");

  const addToCart = useCallback(
    (product: Product, variant: Variant | null) => {
      const line = cart.addItem(product, variant);
      const name = localize(line.name, locale);
      const variantName = line.variantName ? localize(line.variantName, locale) : null;
      show({
        variant: "success",
        text: t("feedback.added", { name: variantName ? `${name} — ${variantName}` : name }),
      });
    },
    [cart, locale, show, t]
  );

  const handleCodeOutcome = useCallback(
    (outcome: CodeOutcome) => {
      if (outcome.status === "added") {
        // The cart line's own confirmation (from addToCart) already said
        // what landed; clearing the box readies it for the next item.
        setQuery("");
        return;
      }
      if (outcome.status === "pick") {
        setScannerOpen(false);
        setPickerProduct(outcome.product);
        setQuery("");
        return;
      }
      show({ variant: "destructive", text: translateError(outcome.code) });
    },
    [show, translateError]
  );

  const { submitCode, isLooking } = useAddByCode({ onAdd: addToCart, onOutcome: handleCodeOutcome });

  // A tapped search result: the list DTO carries no variants, so the full
  // product is fetched before deciding whether to ask which one.
  const selectSearchResult = useCallback(
    async (summary: ProductSummary) => {
      setPendingProductId(summary.id);
      try {
        const product = await queryClient.fetchQuery({
          queryKey: [...PRODUCT_DETAIL_QUERY_KEY, summary.id],
          queryFn: () => fetchProduct(summary.id),
        });

        if (product.hasVariants) {
          setPickerProduct(product);
        } else {
          addToCart(product, null);
          setQuery("");
        }
      } catch (error) {
        show({
          variant: "destructive",
          text: translateError(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL),
        });
      } finally {
        setPendingProductId(null);
      }
    },
    [addToCart, queryClient, show, translateError]
  );

  function handleCheckout() {
    clearMessage();
    checkout.mutate(
      { lines: cart.lines, orderDiscount: cart.orderDiscount },
      {
        onSuccess: (order) => {
          setCompletedOrder(order);
          cart.clear();
          setQuery("");
        },
        onError: (error) => {
          show({
            variant: "destructive",
            text: translateError(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL),
          });
        },
      }
    );
  }

  function startNewSale() {
    setCompletedOrder(null);
    checkout.reset();
  }

  const discountLine = cart.lines.find((line) => line.key === discountLineKey) ?? null;

  if (!canSell) {
    return (
      <main className="px-4 py-10">
        <Alert variant="destructive">{t("noPermission")}</Alert>
      </main>
    );
  }

  // A finished sale takes over the screen: nothing else is worth looking at
  // until the cashier starts the next one.
  if (completedOrder) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <SaleSuccess order={completedOrder} onNewSale={startNewSale} />
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-4 pt-4">
        {/* The search bar stays put while the results or cart scroll under
            it — the next scan is always one tap away. */}
        <div className="sticky top-0 z-20 -mx-4 bg-background/95 px-4 pb-3 backdrop-blur">
          <SearchBar
            value={query}
            onChange={setQuery}
            onScanClick={() => setScannerOpen(true)}
            onSubmitCode={(code) => void submitCode(code)}
            isLooking={isLooking}
          />
        </div>

        {message && (
          <Alert variant={message.variant} className="mb-3">
            {message.text}
          </Alert>
        )}

        {/* pb leaves room for the fixed checkout bar so the last cart line
            is never trapped underneath it. */}
        <div className="pb-64">
          {isSearching ? (
            <SearchResults
              results={search.data}
              isLoading={search.isPending || search.isTyping}
              isError={search.isError}
              pendingId={pendingProductId}
              onSelect={(summary) => void selectSearchResult(summary)}
            />
          ) : (
            <CartPanel cart={cart} onLineDiscountClick={setDiscountLineKey} />
          )}
        </div>
      </main>

      <CheckoutBar
        totals={cart.totals}
        orderDiscount={cart.orderDiscount}
        canCheckout={!cart.isEmpty}
        isSubmitting={checkout.isPending}
        onOrderDiscountClick={() => setOrderDiscountOpen(true)}
        onCheckout={handleCheckout}
      />

      <ScannerSheet
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(code) => void submitCode(code, { dedupe: true })}
        feedback={message}
      />

      <VariantPickerSheet
        product={pickerProduct}
        onOpenChange={(open) => {
          if (!open) setPickerProduct(null);
        }}
        onPick={addToCart}
      />

      {discountLine && (
        <DiscountSheet
          open
          onOpenChange={(open) => {
            if (!open) setDiscountLineKey(null);
          }}
          title={localize(discountLine.name, locale)}
          baseAmount={fromCents(lineGrossCents(discountLine))}
          current={{ type: discountLine.discountType, value: discountLine.discountValue }}
          onApply={(type, value) => cart.setLineDiscount(discountLine.key, type, value)}
        />
      )}

      <DiscountSheet
        open={orderDiscountOpen}
        onOpenChange={setOrderDiscountOpen}
        title={t("checkout.wholeSale")}
        baseAmount={cart.totals.subtotal}
        current={cart.orderDiscount}
        onApply={cart.setOrderDiscount}
      />
    </>
  );
}
