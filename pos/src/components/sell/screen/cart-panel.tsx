"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Gift, MessageCircle, ScanLine } from "lucide-react";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { fromCents, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { CONTROL_HEIGHT, SCREEN_CARD } from "@/components/sell/screen/control-styles";
import { CartLine } from "@/components/sell/screen/cart-line";
import { SectionTitle } from "@/components/sell/screen/section-title";
import type { Cart } from "@/hooks/use-cart";
import type { ScanFlashState } from "@/hooks/use-scan-flash";

interface CartPanelProps {
  cart: Cart;
  scanFlash: ScanFlashState;
  isSubmitting: boolean;
  // Admin/Manager only (order.createGift); absent hides the button.
  onGift?: () => void;
  onDiscount: () => void;
  onCheckout: () => void;
  onWhatsappOrder: () => void;
  // The bottom sheet passes its own title element, so the panel's heading is
  // not drawn twice.
  hideTitle?: boolean;
  className?: string;
}

const TITLE_ID = "pos-cart-title";

// The sale: what is in it, what it comes to, and the two ways to finish it.
// Beside the grid from 1000px; inside the bottom sheet below that.
export function CartPanel({
  cart,
  scanFlash,
  isSubmitting,
  onGift,
  onDiscount,
  onCheckout,
  onWhatsappOrder,
  hideTitle = false,
  className,
}: CartPanelProps) {
  const t = useTranslations("sell");
  const formatMoney = useMoneyFormatter();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const { totals } = cart;
  // Every discount on the sale, line and whole-sale together, as the design
  // shows one "discount" row. Summed in cents — never in floats.
  const discountCents = toCents(totals.itemDiscountTotal) + toCents(totals.orderDiscountAmount);
  const canFinish = !cart.isEmpty && !isSubmitting;

  return (
    <section
      aria-labelledby={hideTitle ? undefined : TITLE_ID}
      aria-label={hideTitle ? t("screen.cartTitle") : undefined}
      className={cn(SCREEN_CARD, "flex min-h-0 flex-col", className)}
      data-test-selector="pos-cart-panel"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 desk:px-5 desk:pt-5">
        <div className="flex min-w-0 items-baseline gap-2">
          {!hideTitle && <SectionTitle id={TITLE_ID}>{t("screen.cartTitle")}</SectionTitle>}
          <span className="truncate text-xs text-muted-foreground" data-test-selector="pos-cart-count">
            {t("search.cartCount", { count: totals.itemCount })}
          </span>
        </div>
        {!cart.isEmpty && (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            data-test-selector="pos-cart-clear"
            className="hit-area shrink-0 rounded-md px-1 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("screen.clear")}
          </button>
        )}
      </div>

      {confirmingClear && !cart.isEmpty && (
        <div
          role="group"
          aria-label={t("screen.clearConfirmTitle")}
          data-test-selector="pos-cart-clear-confirm"
          className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-control border border-destructive/40 bg-destructive/5 p-2 desk:mx-5"
        >
          <p className="min-w-0 flex-1 text-sm font-medium">{t("screen.clearConfirmTitle")}</p>
          <button
            type="button"
            onClick={() => setConfirmingClear(false)}
            className={cn(CONTROL_HEIGHT, "rounded-control border border-border bg-card px-3 text-sm font-medium hover:bg-soft")}
          >
            {t("screen.clearConfirmKeep")}
          </button>
          <button
            type="button"
            onClick={() => {
              cart.clear();
              setConfirmingClear(false);
            }}
            className={cn(CONTROL_HEIGHT, "rounded-control bg-destructive px-3 text-sm font-semibold text-destructive-foreground hover:opacity-90")}
          >
            {t("screen.clearConfirmYes")}
          </button>
        </div>
      )}

      {cart.isEmpty ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center"
          data-test-selector="pos-cart-empty"
        >
          <ScanLine className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-base font-medium">{t("cart.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("cart.emptyHint")}</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-4 desk:px-5" data-test-selector="pos-cart">
          {cart.lines.map((line) => (
            <CartLine
              key={line.key}
              line={line}
              flash={scanFlash.lineKey === line.key ? scanFlash.flash : null}
              onQuantityChange={(quantity) => cart.setQuantity(line.key, quantity)}
              onRemove={() => cart.removeLine(line.key)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-border px-4 pb-4 pt-3 desk:px-5 desk:pb-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("screen.subtotal")}</span>
          <span className="font-bold tabular-nums">{formatMoney(totals.subtotal)}</span>
        </div>
        {/* The whole row is the way to enter a discount on the sale: it is
            where the cashier is looking when the customer asks for one. */}
        <button
          type="button"
          onClick={onDiscount}
          disabled={cart.isEmpty}
          aria-label={t("screen.editDiscount")}
          data-test-selector="pos-order-discount-button"
          className="hit-area -mx-1 flex items-center justify-between rounded-md px-1 text-sm hover:bg-soft disabled:cursor-default disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-muted-foreground">{t("screen.discount")}</span>
          <span className="font-bold tabular-nums">−&#x2009;{formatMoney(fromCents(discountCents))}</span>
        </button>

        <div className="my-1 border-t border-dashed border-border" />

        <div className="flex items-center justify-between">
          <span className="text-base font-bold">{t("checkout.total")}</span>
          <span className="text-2xl font-bold tabular-nums" data-test-selector="pos-cart-total">
            {formatMoney(totals.total)}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={onCheckout}
            disabled={!canFinish}
            data-test-selector="pos-checkout-button"
            className={cn(
              CONTROL_HEIGHT,
              "inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground",
              "transition-colors not-disabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            {isSubmitting && <Spinner />}
            {isSubmitting ? t("checkout.submitting") : t("checkout.submit")}
          </button>
          <button
            type="button"
            onClick={onWhatsappOrder}
            disabled={!canFinish}
            data-test-selector="pos-whatsapp-order-button"
            className={cn(
              CONTROL_HEIGHT,
              "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-border bg-card px-3 text-sm font-medium",
              "transition-colors not-disabled:hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {t("checkout.whatsappOrder")}
          </button>
        </div>

        {/* Not in the design, which is drawn for an Employee: an Admin or a
            Manager can still give a cart away (spec.md "Gifts"). In violet,
            a row below the sale button, so it is never hit in its place. */}
        {onGift && (
          <button
            type="button"
            onClick={onGift}
            disabled={!canFinish}
            data-test-selector="pos-gift-order-button"
            className={cn(
              CONTROL_HEIGHT,
              "inline-flex items-center justify-center gap-2 rounded-control border border-gift/40 px-3 text-sm font-medium text-gift",
              "transition-colors not-disabled:hover:bg-gift/10 disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <Gift className="size-4" aria-hidden="true" />
            {t("checkout.giftOrder")}
          </button>
        )}
      </div>
    </section>
  );
}
