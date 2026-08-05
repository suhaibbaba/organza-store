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
import { useScanFlash } from "@/hooks/use-scan-flash";
import { useScanSound } from "@/hooks/use-scan-sound";
import { useToasts } from "@/hooks/use-toasts";
import { useTranslateError } from "@/hooks/use-translate-error";
import { SearchBar } from "@/components/sell/search-bar";
import { SearchView } from "@/components/sell/search-view";
import { CartPanel } from "@/components/sell/cart-panel";
import { CheckoutBar } from "@/components/sell/checkout-bar";
import { DiscountSheet } from "@/components/sell/discount-sheet";
import { SaleSuccess } from "@/components/sell/sale-success";
import { WhatsappOrderSheet } from "@/components/sell/whatsapp-order-sheet";
import { ScannerSheet } from "@/components/sell/scanner/scanner-sheet";
import { VariantPickerSheet } from "@/components/sell/variant-picker-sheet";
import { Alert } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/toast";
import type { OrderCustomerDraft } from "@/types/customer";
import type { CartLine } from "@/types/cart";
import { lineGrossCents } from "@/lib/cart";
import { fromCents } from "@/lib/money";

// The selling screen. One screen, one job: get what the customer is holding
// into the cart and take the money, in as few taps as possible.
//
// Three ways in, in the order they're reached for at a counter: the camera
// (scan the tag), the search box (when the tag is unreadable), and typing a
// number (numbered shawls — see VariantPickerSheet). All three funnel into
// the same cart.
//
// Nothing any of them do interrupts the next one. An item that lands in the
// cart says so with a beep and a toast that clears itself, the camera keeps
// running until it is closed by hand, and the cart is one tap away from
// wherever the cashier is.
export function SellScreen() {
  const t = useTranslations("sell");
  const locale = useLocale();
  const translateError = useTranslateError();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const cart = useCart();
  const checkout = useCheckout();
  const toasts = useToasts();
  const scanFlash = useScanFlash();
  const scanSound = useScanSound();

  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  // Whether the picker interrupted a run of scans. Set when a scanned code
  // turns out to need a choice, and used to put the camera back afterwards
  // so the cashier carries on from where they were instead of hunting for
  // the scan button again.
  const [resumeScanAfterPick, setResumeScanAfterPick] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [discountLineKey, setDiscountLineKey] = useState<string | null>(null);
  const [orderDiscountOpen, setOrderDiscountOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappErrorCode, setWhatsappErrorCode] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const search = useProductSearch(query);
  const isSearching = query.trim().length > 0;

  // Every staff role can sell, Employee included (spec.md "Roles &
  // Permissions"). Checked here so an account that somehow lacks it sees a
  // plain explanation instead of a screen whose buttons all fail — the real
  // gate is the backend's, on every request (CLAUDE.md rule 5).
  const canSell = can(user, "order.create");

  // One item in the cart, however it got there. All three answers land at
  // once — the beep, the toast naming it and its new quantity, and the lit
  // cart line — because each covers for the others: the sound works while
  // the phone is face down on the counter, the toast works over the open
  // camera, and the line is what is still there afterwards.
  const addToCart = useCallback(
    (product: Product, variant: Variant | null) => {
      const line = cart.addItem(product, variant);
      // Keyed by the line, so scanning one item over and over rewrites a
      // single toast that counts up rather than stacking a column of them.
      toasts.show(
        "success",
        t("feedback.added", { name: lineName(line, locale), quantity: line.quantity }),
        line.key
      );
      scanFlash.markScanned(line.key);
      scanSound.play("success");
    },
    [cart, locale, scanFlash, scanSound, t, toasts]
  );

  const handleCodeOutcome = useCallback(
    (outcome: CodeOutcome) => {
      if (outcome.status === "added") {
        // addToCart has already said what landed; clearing the box readies
        // it for the next item and drops out of the search view.
        setQuery("");
        return;
      }
      if (outcome.status === "pick") {
        // The camera has to go: the choice is the whole screen, and it is
        // put back the moment the choice is made.
        setResumeScanAfterPick(scannerOpen);
        setScannerOpen(false);
        setPickerProduct(outcome.product);
        setQuery("");
        return;
      }
      // Keyed by the code as well: a tag the catalogue doesn't know gets
      // read again and again while it sits under the camera, and that is
      // one problem, not five.
      toasts.show("destructive", translateError(outcome.code), outcome.code);
      scanFlash.markFailed();
      scanSound.play("destructive");
    },
    [scanFlash, scanSound, scannerOpen, toasts, translateError]
  );

  const { submitCode, isLooking, resetScanHistory } = useAddByCode({
    onAdd: addToCart,
    onOutcome: handleCodeOutcome,
  });

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
        }
        // The search stays up either way. It is a place the cashier walked
        // into and leaves by the door at the top (SearchView) — yanking it
        // away mid-errand is the behaviour that made the cart feel lost in
        // the first place, and a customer buying three dresses off one list
        // would have to type the same word three times. The toast and the
        // count on that door say what just went in.
      } catch (error) {
        toasts.show("destructive", translateError(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL));
      } finally {
        setPendingProductId(null);
      }
    },
    [addToCart, queryClient, toasts, translateError]
  );

  // Both endings of a cart go through here: without a customer it is a
  // counter sale, with one it is a WhatsApp order for delivery. Only where
  // the failure is shown differs — the WhatsApp sheet covers the screen, so
  // its own message has to be inside it.
  function submitOrder(customer?: OrderCustomerDraft) {
    toasts.clear();
    setWhatsappErrorCode(null);
    checkout.mutate(
      { lines: cart.lines, orderDiscount: cart.orderDiscount, customer },
      {
        onSuccess: (order) => {
          setCompletedOrder(order);
          setWhatsappOpen(false);
          cart.clear();
          setQuery("");
        },
        onError: (error) => {
          const code = error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL;
          if (customer) {
            setWhatsappErrorCode(code);
            return;
          }
          toasts.show("destructive", translateError(code));
        },
      }
    );
  }

  function startNewSale() {
    setCompletedOrder(null);
    setWhatsappErrorCode(null);
    checkout.reset();
  }

  function openScanner() {
    // The tap that opens the camera is also the user gesture browsers
    // require before any sound may be played — take it while it's here, or
    // the first successful scan of the shift is silent.
    scanSound.unlock();
    // Opening it by hand means "scan this now", whatever it is — including
    // the tag that was last in front of the lens.
    resetScanHistory();
    setScannerOpen(true);
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
            onScanClick={openScanner}
            onSubmitCode={(code) => void submitCode(code)}
            isLooking={isLooking}
          />
        </div>

        {/* pb leaves room for the fixed checkout bar so the last cart line is
            never trapped underneath it. The height is the bar's own measured
            one (CheckoutBar publishes it), not a guess, so it stays right as
            the bar grows a discount line — plus a little breathing room. */}
        <div className="pb-[calc(var(--checkout-bar-height)+1rem)]">
          {isSearching ? (
            <SearchView
              query={query.trim()}
              cartItemCount={cart.totals.itemCount}
              results={search.data}
              isLoading={search.isPending || search.isTyping}
              isError={search.isError}
              pendingId={pendingProductId}
              onSelect={(summary) => void selectSearchResult(summary)}
              onBack={() => setQuery("")}
            />
          ) : (
            <CartPanel cart={cart} scanFlash={scanFlash} onLineDiscountClick={setDiscountLineKey} />
          )}
        </div>
      </main>

      <CheckoutBar
        totals={cart.totals}
        orderDiscount={cart.orderDiscount}
        canCheckout={!cart.isEmpty}
        isSubmitting={checkout.isPending}
        onOrderDiscountClick={() => setOrderDiscountOpen(true)}
        onCheckout={() => submitOrder()}
        onWhatsappOrder={() => setWhatsappOpen(true)}
      />

      <WhatsappOrderSheet
        open={whatsappOpen}
        onOpenChange={(open) => {
          setWhatsappOpen(open);
          if (!open) setWhatsappErrorCode(null);
        }}
        total={cart.totals.total}
        isSubmitting={checkout.isPending}
        errorCode={whatsappErrorCode}
        onSubmit={(customer) => submitOrder(customer)}
      />

      <ScannerSheet
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(code) => void submitCode(code, { dedupe: true })}
        pulse={scanFlash.pulse}
        totals={cart.totals}
        isMuted={scanSound.isMuted}
        onToggleMute={scanSound.toggleMute}
      />

      <VariantPickerSheet
        product={pickerProduct}
        onOpenChange={(open) => {
          if (open) return;
          setPickerProduct(null);
          if (resumeScanAfterPick) {
            setResumeScanAfterPick(false);
            setScannerOpen(true);
          }
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

      {/* While the camera is up it owns the bottom of the screen, so the
          confirmations move to the strip above it; the rest of the time
          they sit low, out of the way of the search box and of the cart
          line they are talking about. */}
      <Toaster toasts={toasts.toasts} placement={scannerOpen ? "top" : "bottom"} />
    </>
  );
}

// What to call a line out loud: the product, plus the variant when there is
// one, because "Silk Scarf" alone tells a cashier nothing about which of the
// eight they just scanned.
function lineName(line: CartLine, locale: string): string {
  const name = localize(line.name, locale);
  const variantName = line.variantName ? localize(line.variantName, locale) : null;
  return variantName ? `${name} — ${variantName}` : name;
}
