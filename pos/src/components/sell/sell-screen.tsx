"use client";

import { useCallback, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { can } from "@organza/shared/lib/permissions";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import type { Order } from "@organza/shared/types/order";
import type { Product, ProductSummary } from "@organza/shared/types/product";
import type { Variant } from "@organza/shared/types/variant";
import { PRODUCT_DETAIL_QUERY_KEY } from "@/constants/api";
import { ApiError } from "@/lib/api/errors";
import { fetchProduct } from "@/lib/api/products";
import { localize } from "@/lib/i18n-content";
import { useSession } from "@/components/providers/session-provider";
import { useCart } from "@/hooks/use-cart";
import { useAddByCode, type CodeOutcome } from "@/hooks/use-add-by-code";
import { useCheckout } from "@/hooks/use-checkout";
import { useHardwareScanner } from "@/hooks/use-hardware-scanner";
import { useProductBrowse } from "@/hooks/use-product-browse";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useScanFeedback } from "@/hooks/use-scan-feedback";
import { useScanFlash } from "@/hooks/use-scan-flash";
import { useSellShortcuts } from "@/hooks/use-sell-shortcuts";
import { useToasts } from "@/hooks/use-toasts";
import { errorMessageKey } from "@/hooks/use-translate-error";
import { TopBar } from "@/components/layout/top-bar";
import { SearchField } from "@/components/sell/screen/search-field";
import { TopBarActions } from "@/components/sell/screen/top-bar-actions";
import { CategoryTiles } from "@/components/sell/screen/category-tiles";
import { ProductGrid } from "@/components/sell/screen/product-grid";
import { CartPanel } from "@/components/sell/screen/cart-panel";
import { CartBar } from "@/components/sell/screen/cart-bar";
import { CartSheet } from "@/components/sell/screen/cart-sheet";
import { DiscountSheet } from "@/components/sell/discount-sheet";
import { SaleSuccess } from "@/components/sell/sale-success";
import { WhatsappOrderSheet } from "@/components/sell/whatsapp-order-sheet";
import { GiftOrderSheet } from "@/components/sell/gift-order-sheet";
import { QuickSellSheet } from "@/components/sell/quick-sell-sheet";
import { ScannerSheet } from "@/components/sell/scanner/scanner-sheet";
import { VariantPickerSheet } from "@/components/sell/variant-picker-sheet";
import { Alert } from "@store/ui";
import type { OrderCustomerDraft } from "@/types/customer";
import type { CartLine } from "@/types/cart";
import { lineGrossCents } from "@/lib/cart";
import { fromCents } from "@/lib/money";
import { DESK_MEDIA_QUERY } from "@/constants/layout";
import { cn } from "@/lib/utils";

// Camera, counter scanner, search box and typed numbers all funnel through submitCode; nothing interrupts the next scan.
export function SellScreen() {
  const t = useTranslations("sell");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const cart = useCart();
  const checkout = useCheckout();
  const toasts = useToasts();
  const scanFlash = useScanFlash();
  const scanFeedback = useScanFeedback();

  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  // null = "All".
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  // Whether the picker interrupted a run of scans, so the camera goes back up afterwards.
  const [resumeScanAfterPick, setResumeScanAfterPick] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [discountLineKey, setDiscountLineKey] = useState<string | null>(null);
  const [orderDiscountOpen, setOrderDiscountOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappErrorCode, setWhatsappErrorCode] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [quickSellOpen, setQuickSellOpen] = useState(false);
  const [giftErrorCode, setGiftErrorCode] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  // Only focused by a deliberate keypress, never on mount (a phone would open its keyboard over the cart).
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const browse = useProductBrowse({ categoryId, query });
  const isSearching = query.trim().length > 0;

  // From 1000px the side panel shows the cart, so the sheet is never open there.
  const isDesk = useMediaQuery(DESK_MEDIA_QUERY);

  // The real gate is the backend's (rule 5); this only explains instead of drawing buttons that all fail.
  const canSell = can(user, "order.create");
  // Admin/Manager only (spec.md "Gifts"); the backend refuses it either way.
  const canGift = can(user, "order.createGift");
  // Every role as shipped, switchable per role (spec.md "Quick sell"); the backend refuses it either way.
  const canQuickSell = can(user, "product.quickSell");

  // Beep, buzz, toast and lit line all land at once: each covers for the others when the shop is loud or the phone face down.
  const addToCart = useCallback(
    (product: Product, variant: Variant | null) => {
      const line = cart.addItem(product, variant);
      toasts.show("success", "sell.feedback.added", { name: lineName(line, locale), quantity: line.quantity }, line.key);
      scanFlash.markScanned(line.key);
      scanFeedback.play("success");
    },
    [cart, locale, scanFeedback, scanFlash, toasts]
  );

  // A handful from the variant picker: each variant its own line at quantity 1, told once.
  const addManyToCart = useCallback(
    (product: Product, variants: Variant[]) => {
      if (variants.length === 0) return;
      // One is not "many": it keeps the named, counting toast a scan would get.
      if (variants.length === 1) {
        addToCart(product, variants[0]);
        return;
      }

      const lines = variants.map((variant) => cart.addItem(product, variant));
      toasts.show("success", "sell.feedback.addedMany", { name: localize(product.name, locale), count: lines.length });
      // addItem prepends, so the last one added is the line at the top worth lighting.
      scanFlash.markScanned(lines[lines.length - 1].key);
      scanFeedback.play("success");
    },
    [addToCart, cart, locale, scanFeedback, scanFlash, toasts]
  );

  const handleCodeOutcome = useCallback(
    (outcome: CodeOutcome) => {
      if (outcome.status === "added") {
        setQuery("");
        return;
      }
      if (outcome.status === "pick") {
        // The camera goes while the choice is made, and comes back after.
        setResumeScanAfterPick(scannerOpen);
        setScannerOpen(false);
        setPickerProduct(outcome.product);
        setQuery("");
        return;
      }
      // Keyed by the code: an unknown tag under the camera is one problem, not five.
      toasts.show("destructive", errorMessageKey(outcome.code), undefined, outcome.code);
      scanFlash.markFailed();
      scanFeedback.play("destructive");
    },
    [scanFeedback, scanFlash, scannerOpen, toasts]
  );

  const { submitCode, isLooking, resetScanHistory } = useAddByCode({
    onAdd: addToCart,
    onOutcome: handleCodeOutcome,
  });

  // While one of these is up a scan would land in a cart nobody can see (or change a gift list already read).
  const isAskingSomethingElse =
    whatsappOpen || giftOpen || orderDiscountOpen || discountLineKey !== null;
  // Sheets that are part of finding what is sold: the counter scanner keeps working, keyboard shortcuts do not.
  const isFindingSheetOpen = pickerProduct !== null || scannerOpen;

  // The counter's plug-in scanner: the same call as the camera.
  useHardwareScanner({
    enabled: canSell && completedOrder === null && !isAskingSomethingElse,
    onScan: (code) => {
      // At the counter a keypress is the only user gesture there is to unlock the first beep.
      scanFeedback.unlock();
      void submitCode(code, { dedupe: true });
    },
  });

  // Counter keyboard shortcuts; every one is also a button.
  useSellShortcuts({
    enabled: canSell && completedOrder === null && !isAskingSomethingElse && !isFindingSheetOpen,
    onFocusSearch: () => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      // Selected: reaching for the search box means a new search, not a longer one.
      input.select();
    },
    onScan: openScanner,
    onCheckout: () => {
      if (cart.isEmpty || checkout.isPending) return;
      submitOrder();
    },
    onClear: () => {
      setQuery("");
      // Back to the page, where the hardware scanner reads from.
      searchInputRef.current?.blur();
    },
  });

  // The list DTO carries no variants, so the full product is fetched first; answers whether the tap got anywhere.
  const selectSearchResult = useCallback(
    async (summary: ProductSummary): Promise<boolean> => {
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
        // The search stays up: a customer buying three dresses off one list should not need it typed three times.
        return true;
      } catch (error) {
        toasts.show("destructive", errorMessageKey(error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL));
        return false;
      } finally {
        setPendingProductId(null);
      }
    },
    [addToCart, queryClient, toasts]
  );

  // Counter sale, WhatsApp order (customer) or gift; a sheet's failure is shown inside the sheet that covers the screen.
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
          setCartOpen(false);
          cart.clear();
          setQuery("");
        },
        onError: (error) => {
          const code = error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL;
          if (customer) {
            setWhatsappErrorCode(code);
            return;
          }
          if (gift) {
            setGiftErrorCode(code);
            return;
          }
          toasts.show("destructive", errorMessageKey(code));
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
    // The tap is the user gesture browsers require before any sound may play.
    scanFeedback.unlock();
    // Opening it by hand means "scan this now", including the tag last in front of the lens.
    resetScanHistory();
    setScannerOpen(true);
  }

  const discountLine = cart.lines.find((line) => line.key === discountLineKey) ?? null;

  if (!canSell) {
    return (
      <>
        <TopBar />
        <main className="px-4 py-10">
          <Alert tone="danger">{t("noPermission")}</Alert>
        </main>
      </>
    );
  }

  // A finished sale takes over the screen until the next one starts.
  if (completedOrder) {
    return (
      <>
        <TopBar />
        <main className="mx-auto w-full max-w-2xl px-4 py-6">
          <SaleSuccess order={completedOrder} onNewSale={startNewSale} />
        </main>
      </>
    );
  }

  const cartPanelProps = {
    cart,
    scanFlash,
    isSubmitting: checkout.isPending,
    onGift: canGift ? () => setGiftOpen(true) : undefined,
    onDiscount: () => setOrderDiscountOpen(true),
    onCheckout: () => submitOrder(),
    onWhatsappOrder: () => setWhatsappOpen(true),
  };

  return (
    <>
      <TopBar
        tools={
          <>
            <SearchField
              value={query}
              onChange={setQuery}
              onSubmitCode={(code) => void submitCode(code)}
              isLooking={isLooking}
              inputRef={searchInputRef}
              className="flex-1 desk:max-w-[29rem]"
            />
            <TopBarActions onScan={openScanner} onQuickSell={canQuickSell ? () => setQuickSellOpen(true) : undefined} />
          </>
        }
      />

      {/* From 1000px the cart is a panel at the end; below, the cart bar stands in and the grid leaves room for it. */}
      <div className="flex items-start gap-3 p-3 tab:gap-4 tab:p-4">
        <main className="flex min-w-0 flex-1 flex-col gap-3 pb-[var(--checkout-bar-height)] tab:gap-4 desk:pb-0">
          <CategoryTiles selectedId={categoryId} onSelect={setCategoryId} />
          <ProductGrid
            products={browse.products}
            isLoading={browse.isPending || browse.isTyping}
            isError={browse.isError}
            isSearching={isSearching}
            isFiltered={categoryId !== null}
            onClearFilters={() => setCategoryId(null)}
            hasNextPage={browse.hasNextPage}
            isFetchingNextPage={browse.isFetchingNextPage}
            onShowMore={() => void browse.fetchNextPage()}
            pendingId={pendingProductId}
            onAdd={(summary) => void selectSearchResult(summary)}
            onQuickSell={canQuickSell ? () => setQuickSellOpen(true) : undefined}
          />
        </main>

        <aside
          className={cn(
            "sticky top-[calc(var(--top-bar-inset)+1rem)] hidden h-[calc(100dvh-var(--top-bar-inset)-2rem)] w-[22.25rem] shrink-0",
            "desk:flex wide:w-[23.25rem]"
          )}
        >
          <CartPanel {...cartPanelProps} className="w-full" />
        </aside>
      </div>

      <CartBar totals={cart.totals} onOpen={() => setCartOpen(true)} className="desk:hidden" />
      <CartSheet open={cartOpen && !isDesk} onOpenChange={setCartOpen} {...cartPanelProps} />

      {canQuickSell && (
        <QuickSellSheet
          open={quickSellOpen}
          onOpenChange={setQuickSellOpen}
          onAdd={(input) => {
            const line = cart.addQuickSellItem(input, 1);
            scanFlash.markScanned(line.key);
            toasts.show("success", "sell.quickSell.added", { name: input.name });
            setQuery("");
          }}
        />
      )}

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
          // The camera is not going back up, so stop holding the code: at the counter the same tag is pulled again on purpose.
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
    </>
  );
}

// "Silk Scarf" alone does not say which of the eight was just scanned.
function lineName(line: CartLine, locale: string): string {
  const name = localize(line.name, locale);
  const variantName = line.variantName ? localize(line.variantName, locale) : null;
  return variantName ? `${name} — ${variantName}` : name;
}
