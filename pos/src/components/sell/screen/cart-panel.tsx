"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Gift, MessageCircle, ScanLine } from "lucide-react";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { fromCents, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@store/ui";
import { CONTROL_HEIGHT, SCREEN_PANEL } from "@/components/sell/screen/control-styles";
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
  // The bottom sheet draws its own title.
  hideTitle?: boolean;
  className?: string;
}

const TITLE_ID = "pos-cart-title";

// The sale: beside the grid from 1000px, inside the bottom sheet below that.
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
  // Line and whole-sale discounts as one row, summed in cents — never in floats.
  const discountCents = toCents(totals.itemDiscountTotal) + toCents(totals.orderDiscountAmount);
  const canFinish = !cart.isEmpty && !isSubmitting;

  return (
    <section
      aria-labelledby={hideTitle ? undefined : TITLE_ID}
      aria-label={hideTitle ? t("screen.cartTitle") : undefined}
      className={cn(SCREEN_PANEL, "flex min-h-0 flex-col", className)}
      data-test-selector="pos-cart-panel"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 desk:px-5 desk:pt-5">
        <div className="flex min-w-0 items-baseline gap-2">
          {!hideTitle && <SectionTitle id={TITLE_ID}>{t("screen.cartTitle")}</SectionTitle>}
          <span className="truncate text-micro text-ink-muted" data-test-selector="pos-cart-count">
            {t("search.cartCount", { count: totals.itemCount })}
          </span>
        </div>
        {!cart.isEmpty && (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            data-test-selector="pos-cart-clear"
            className="hit-area shrink-0 cursor-pointer rounded-control px-1 text-label text-primary-600 transition-colors hover:text-primary-700 focus-visible:bg-primary-100 focus-visible:text-primary-900"
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
          className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-control border border-danger-200 bg-danger-50 p-2 desk:mx-5"
        >
          <p className="min-w-0 flex-1 text-label font-medium text-ink">{t("screen.clearConfirmTitle")}</p>
          <Button variant="secondary" onClick={() => setConfirmingClear(false)} className={cn(CONTROL_HEIGHT, "px-3")}>
            {t("screen.clearConfirmKeep")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              cart.clear();
              setConfirmingClear(false);
            }}
            className={cn(CONTROL_HEIGHT, "px-3 font-semibold")}
          >
            {t("screen.clearConfirmYes")}
          </Button>
        </div>
      )}

      {cart.isEmpty ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center"
          data-test-selector="pos-cart-empty"
        >
          <ScanLine className="size-8 text-ink-subtle" aria-hidden="true" />
          <p className="text-section font-medium text-ink">{t("cart.emptyTitle")}</p>
          <p className="text-label text-ink-muted">{t("cart.emptyHint")}</p>
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

      <div className="flex flex-col gap-2 border-t border-line px-4 pb-4 pt-3 desk:px-5 desk:pb-5">
        <div className="flex items-center justify-between text-label">
          <span className="text-ink-subtle">{t("screen.subtotal")}</span>
          <span className="font-semibold text-ink tabular-nums">{formatMoney(totals.subtotal)}</span>
        </div>
        {/* The whole row enters a discount on the sale: it is where the cashier is looking when asked for one. */}
        <button
          type="button"
          onClick={onDiscount}
          disabled={cart.isEmpty}
          aria-label={t("screen.editDiscount")}
          data-test-selector="pos-order-discount-button"
          className="hit-area -mx-1 flex cursor-pointer items-center justify-between rounded-control px-1 text-label hover:bg-primary-50 disabled:cursor-default disabled:hover:bg-transparent focus-visible:bg-primary-200"
        >
          <span className="text-ink-subtle">{t("screen.discount")}</span>
          <span className={cn("font-semibold text-ink tabular-nums", discountCents > 0 && "text-success-700")}>
            −&#x2009;{formatMoney(fromCents(discountCents))}
          </span>
        </button>

        {/* What the customer pays, on its own band so it is the first thing an eye finds. */}
        <div className="mt-1 flex items-center justify-between gap-3 rounded-control bg-primary-50 px-3.5 py-2.5">
          <span className="text-section font-bold text-primary-700">{t("checkout.total")}</span>
          <span className="text-2xl font-bold text-ink tabular-nums" data-test-selector="pos-cart-total">
            {formatMoney(totals.total)}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          {/* 52px and bold: the one button on the screen that takes money. */}
          <Button
            onClick={onCheckout}
            disabled={!canFinish}
            isLoading={isSubmitting}
            data-test-selector="pos-checkout-button"
            className="h-13 min-w-0 flex-1 px-4 text-section font-bold shadow-card aria-disabled:shadow-none"
          >
            {isSubmitting ? t("checkout.submitting") : t("checkout.submit")}
          </Button>
          <Button
            variant="secondary"
            onClick={onWhatsappOrder}
            disabled={!canFinish}
            data-test-selector="pos-whatsapp-order-button"
            icon={<MessageCircle className="size-4" aria-hidden="true" />}
            className="h-13 shrink-0 px-3"
          >
            {t("checkout.whatsappOrder")}
          </Button>
        </div>

        {/* Admin/Manager only (spec.md "Gifts"); a row below the sale button so it is never hit in its place. */}
        {onGift && (
          <Button
            variant="secondary"
            onClick={onGift}
            disabled={!canFinish}
            data-test-selector="pos-gift-order-button"
            icon={<Gift className="size-4" aria-hidden="true" />}
            className={cn(
              CONTROL_HEIGHT,
              "border-tint-5-ink/30 text-tint-5-ink hover:border-tint-5-ink hover:bg-tint-5-bg hover:text-tint-5-ink"
            )}
          >
            {t("checkout.giftOrder")}
          </Button>
        )}
      </div>
    </section>
  );
}
