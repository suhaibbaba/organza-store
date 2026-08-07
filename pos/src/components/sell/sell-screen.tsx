"use client";

import { useCallback, useRef, useState } from "react";
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
import { useHardwareScanner } from "@/hooks/use-hardware-scanner";
import { useProductSearch } from "@/hooks/use-product-search";
import { useScanFeedback } from "@/hooks/use-scan-feedback";
import { useScanFlash } from "@/hooks/use-scan-flash";
import { useSellShortcuts } from "@/hooks/use-sell-shortcuts";
import { useToasts } from "@/hooks/use-toasts";
import { useTranslateError } from "@/hooks/use-translate-error";
import { SearchBar } from "@/components/sell/search-bar";
import { SearchView } from "@/components/sell/search-view";
import { CartPanel } from "@/components/sell/cart-panel";
import { CounterPanel } from "@/components/sell/counter-panel";
import { CheckoutBar } from "@/components/sell/checkout-bar";
import { DiscountSheet } from "@/components/sell/discount-sheet";
import { SaleSuccess } from "@/components/sell/sale-success";
import { WhatsappOrderSheet } from "@/components/sell/whatsapp-order-sheet";
import { GiftOrderSheet } from "@/components/sell/gift-order-sheet";
import { ScannerSheet } from "@/components/sell/scanner/scanner-sheet";
import { VariantPickerSheet } from "@/components/sell/variant-picker-sheet";
import { Alert } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/toast";
import type { OrderCustomerDraft } from "@/types/customer";
import type { CartLine } from "@/types/cart";
import { lineGrossCents } from "@/lib/cart";
import { fromCents } from "@/lib/money";
import { cn } from "@/lib/utils";

// The selling screen. One screen, one job: get what the customer is holding
// into the cart and take the money, in as few taps as possible.
//
// Four ways in, in the order they're reached for: the phone's camera (scan
// the tag), the counter's plug-in scanner (pull the trigger), the search box
// (when the tag is unreadable), and typing a number (numbered shawls — see
// VariantPickerSheet). All four funnel into the same cart, through the same
// submitCode, and answer the same way.
//
// Nothing any of them do interrupts the next one. An item that lands in the
// cart says so with a beep and a toast that clears itself, the camera keeps
// running until it is closed by hand, and the cart is one tap away from
// wherever the cashier is.
//
// The phone is the till this was built for and stays the default: one column,
// cart or search, checkout under the thumb. From `lg` up — the counter's
// laptop, and the touch monitor planned to go with it — the same pieces
// split into two columns so the cart never has to be swapped back to. That
// is a second arrangement of this screen, not a second screen: every
// difference below is a responsive class, and the phone's path through the
// code is the one it always had.
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
  const scanFeedback = useScanFeedback();

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
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftErrorCode, setGiftErrorCode] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  // Only ever focused by a deliberate keypress from the counter keyboard —
  // never on mount, which on a phone would open the keyboard over the cart.
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const search = useProductSearch(query);
  const isSearching = query.trim().length > 0;

  // Every staff role can sell, Employee included (spec.md "Roles &
  // Permissions"). Checked here so an account that somehow lacks it sees a
  // plain explanation instead of a screen whose buttons all fail — the real
  // gate is the backend's, on every request (CLAUDE.md rule 5).
  const canSell = can(user, "order.create");
  // Giving stock away is Admin/Manager only: an Employee who could file a
  // sale as a gift could walk out with the piece (spec.md "Gifts"). This
  // decides whether the action is drawn at all; the backend refuses the
  // request either way.
  const canGift = can(user, "order.createGift");

  // One item in the cart, however it got there. All four answers land at
  // once — the beep, the buzz, the toast naming it and its new quantity, and
  // the lit cart line — because each covers for the others: the sound works
  // while the phone is face down on the counter, the buzz works while the shop
  // is too loud for the sound (or iOS has silenced it), the toast works over
  // the open camera, and the line is what is still there afterwards.
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
      scanFeedback.play("success");
    },
    [cart, locale, scanFeedback, scanFlash, t, toasts]
  );

  // A whole handful at once, from the variant picker: the same dress in M and
  // L, three shawls off one photo. Each variant becomes its own line at
  // quantity 1 (the cart is where a quantity is changed), and the cashier is
  // told once — a toast per variant would push the others off the screen and
  // still leave them counting ticks to check.
  const addManyToCart = useCallback(
    (product: Product, variants: Variant[]) => {
      if (variants.length === 0) return;
      // One is not "many": it keeps the named, counting toast it would have
      // had from a scan, which says more than a bare "1 added".
      if (variants.length === 1) {
        addToCart(product, variants[0]);
        return;
      }

      const lines = variants.map((variant) => cart.addItem(product, variant));
      toasts.show(
        "success",
        t("feedback.addedMany", { name: localize(product.name, locale), count: lines.length })
      );
      // The last one added sits at the top of the cart (addItem prepends), so
      // that is the line worth lighting — the rest are right under it.
      scanFlash.markScanned(lines[lines.length - 1].key);
      scanFeedback.play("success");
    },
    [addToCart, cart, locale, scanFeedback, scanFlash, t, toasts]
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
      scanFeedback.play("destructive");
    },
    [scanFeedback, scanFlash, scannerOpen, toasts, translateError]
  );

  const { submitCode, isLooking, resetScanHistory } = useAddByCode({
    onAdd: addToCart,
    onOutcome: handleCodeOutcome,
  });

  // Sheets that ask about something other than what is being scanned. While
  // one of them has the screen, a scan would land in a cart nobody can see
  // and a function key would answer a question that was not asked. The gift
  // confirmation is the sharpest case of both: it lists what is about to be
  // given away, and a scan landing behind it would change that list after the
  // cashier read it.
  const isAskingSomethingElse =
    whatsappOpen || giftOpen || orderDiscountOpen || discountLineKey !== null;
  // The two sheets that ARE part of scanning: the picker a variant-bearing
  // parent raises, and the camera. Neither of them takes a text field's focus
  // (SheetContent's onOpenAutoFocus), so the counter's scanner keeps working
  // straight through — the next trigger pull just replaces what is on screen.
  const isScanningSheetOpen = pickerProduct !== null || scannerOpen;

  // The counter's plug-in scanner. What a scan does is the camera's behaviour
  // verbatim — the same lookup, the same toast, the same beep, the same
  // swallowing of repeats — because it is the same call.
  useHardwareScanner({
    enabled: canSell && completedOrder === null && !isAskingSomethingElse,
    onScan: (code) => {
      // A keypress is a user gesture, and at the counter it is the only one
      // there is: nobody taps the scan button, so without taking this one
      // the browser would never let the first beep of the shift play.
      scanFeedback.unlock();
      void submitCode(code, { dedupe: true });
    },
  });

  // Keys for the counter keyboard. Every one of them is also a button, and
  // the phone — which has no keyboard — never sees any of this.
  useSellShortcuts({
    enabled: canSell && completedOrder === null && !isAskingSomethingElse && !isScanningSheetOpen,
    onFocusSearch: () => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      // Selected, not appended to: reaching for the search box means a new
      // search, not a longer one.
      input.select();
    },
    onScan: openScanner,
    onCheckout: () => {
      if (cart.isEmpty || checkout.isPending) return;
      submitOrder();
    },
    onClear: () => {
      setQuery("");
      // Focus goes back to the page, which is where the hardware scanner
      // reads from — otherwise clearing the box would leave the cursor in it
      // and the next trigger pull would type into it instead.
      searchInputRef.current?.blur();
    },
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

  // Every ending of a cart goes through here: on its own it is a counter
  // sale, with a customer it is a WhatsApp order for delivery, and with
  // `gift` it is stock given away for nothing (spec.md "Gifts"). Only where
  // the failure is shown differs — each sheet covers the screen, so its own
  // message has to be inside it, or a refused save would look like nothing
  // happening at all.
  function submitOrder(options: { customer?: OrderCustomerDraft; gift?: { note: string } } = {}) {
    const { customer, gift } = options;
    toasts.clear();
    setWhatsappErrorCode(null);
    setGiftErrorCode(null);
    checkout.mutate(
      { lines: cart.lines, orderDiscount: cart.orderDiscount, customer, gift },
      {
        onSuccess: (order) => {
          setCompletedOrder(order);
          setWhatsappOpen(false);
          setGiftOpen(false);
          cart.clear();
          setQuery("");
        },
        onError: (error) => {
          const code = error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL;
          if (customer) {
            setWhatsappErrorCode(code);
            return;
          }
          // An Employee who reached this call at all is refused here (403),
          // which is the gate that matters — the hidden button is only the
          // courtesy in front of it.
          if (gift) {
            setGiftErrorCode(code);
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
    scanFeedback.unlock();
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
      {/* One column on a phone, two from `lg`. The pb reserves room for the
          fixed checkout bar at every width so the last cart line is never
          trapped underneath it — the height is the bar's own measured one
          (CheckoutBar publishes it), not a guess, so it stays right as the
          bar grows a discount line or reflows into a single row on a laptop.

          The two columns are the other way round from how they started. The
          finding side used to take everything left over after a fixed 24rem
          cart, which on the counter's laptop meant a half-empty panel filling
          most of the screen while the sale — the thing actually being worked
          on, and the thing with the most in it — was squeezed into a strip.
          Now the finding side is the one that is capped and the cart takes
          the rest, so the sale gets the room and the search column is only
          ever as wide as a result card needs to be. */}
      <main
        className={cn(
          "mx-auto w-full max-w-2xl px-4 pb-[calc(var(--checkout-bar-height)+1rem)] pt-4",
          "lg:grid lg:max-w-6xl lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-6",
          "xl:grid-cols-[26rem_minmax(0,1fr)]"
        )}
      >
        {/* Finding things: the search box, and whatever it turns up. */}
        <div className="min-w-0">
          {/* The search bar stays put while the results or cart scroll under
              it — the next scan is always one tap away. The bleed to the
              screen edge is a phone thing; in a column it would spill into
              the gutter, so it is dropped from `lg`, where the bar instead
              sticks below the top bar rather than under it. */}
          <div
            className={cn(
              "sticky top-0 z-20 -mx-4 bg-background/95 px-4 pb-3 backdrop-blur",
              "lg:top-[var(--top-bar-inset)] lg:mx-0 lg:px-0"
            )}
          >
            <SearchBar
              value={query}
              onChange={setQuery}
              onScanClick={openScanner}
              onSubmitCode={(code) => void submitCode(code)}
              isLooking={isLooking}
              inputRef={searchInputRef}
            />
          </div>

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
            // Renders from `lg` only: on a phone this column IS the cart when
            // nothing is being searched for, and there is nothing to fill.
            <CounterPanel onScanClick={openScanner} />
          )}
        </div>

        {/* The sale. On a phone it is the screen's resting state, swapped out
            by the search — exactly as before. From `lg` it is a column of its
            own that never goes away, and it sticks so a long list of results
            beside it cannot scroll the cart off the top. */}
        <section
          aria-label={t("cart.title")}
          className={cn(
            "min-w-0",
            isSearching && "hidden lg:block",
            "lg:sticky lg:top-[calc(var(--top-bar-inset)+1rem)]",
            "lg:max-h-[calc(100dvh-var(--top-bar-inset)-var(--checkout-bar-height)-2rem)] lg:overflow-y-auto"
          )}
        >
          {/* Two columns need saying which is which; one column does not —
              on a phone the section's label carries it for screen readers
              without spending a line of a small screen on a word. */}
          <h2 className="mb-3 hidden text-base font-semibold lg:block" aria-hidden="true">
            {t("cart.title")}
          </h2>
          <CartPanel cart={cart} scanFlash={scanFlash} onLineDiscountClick={setDiscountLineKey} />
        </section>
      </main>

      <CheckoutBar
        totals={cart.totals}
        orderDiscount={cart.orderDiscount}
        canCheckout={!cart.isEmpty}
        isSubmitting={checkout.isPending}
        canGift={canGift}
        onOrderDiscountClick={() => setOrderDiscountOpen(true)}
        onCheckout={() => submitOrder()}
        onWhatsappOrder={() => setWhatsappOpen(true)}
        onGiftOrder={() => setGiftOpen(true)}
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
        onSubmit={(customer) => submitOrder({ customer })}
      />

      {/* Only mounted for an account that may give stock away, so there is
          nothing behind the hidden button either. */}
      {canGift && (
        <GiftOrderSheet
          open={giftOpen}
          onOpenChange={(open) => {
            setGiftOpen(open);
            if (!open) setGiftErrorCode(null);
          }}
          lines={cart.lines}
          itemCount={cart.totals.itemCount}
          isSubmitting={checkout.isPending}
          errorCode={giftErrorCode}
          onConfirm={(note) => submitOrder({ gift: { note } })}
        />
      )}

      <ScannerSheet
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(code) => void submitCode(code, { dedupe: true })}
        pulse={scanFlash.pulse}
        totals={cart.totals}
        sound={scanFeedback.sound}
        vibration={scanFeedback.vibration}
      />

      <VariantPickerSheet
        product={pickerProduct}
        onOpenChange={(open) => {
          if (open) return;
          setPickerProduct(null);
          if (resumeScanAfterPick) {
            setResumeScanAfterPick(false);
            setScannerOpen(true);
            return;
          }
          // The camera is not going back up, so the reason the code that
          // raised this question is being held — that the tag is still lying
          // under the lens — has gone with it. At the counter the same tag
          // is pulled again on purpose for the second piece, and holding it
          // would swallow that scan and every repeat after it.
          resetScanHistory();
        }}
        onPick={addManyToCart}
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

      <Toaster toasts={toasts.toasts} />
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
