"use client";

import { useTranslations } from "next-intl";
import { Clock, Gift, MessageCircle, Pencil, Repeat, Trash2 } from "lucide-react";
import { Alert, Button, EmptyState, IconButton, SegmentedControl, Switch, Typography, useConfirm } from "@store/ui";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { fromCents, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SCREEN_PANEL } from "@/components/sell/screen/control-styles";
import { CartLine } from "@/components/sell/screen/cart-line";
import { SectionTitle } from "@/components/sell/screen/section-title";
import { ExchangeBanner } from "@/components/sell/exchange/exchange-banner";
import { exchangeDifferenceCents, exchangeSide, hasQuickSellLines } from "@/lib/exchange";
import type { ExchangeCartState } from "@/types/exchange";
import type { Cart } from "@/hooks/use-cart";
import type { ScanFlashState } from "@/hooks/use-scan-flash";
import type { CheckoutChoice, SaleChannel, SalePayment } from "@/types/sell";

interface CartPanelProps {
  cart: Cart;
  scanFlash: ScanFlashState;
  isSubmitting: boolean;
  choice: CheckoutChoice;
  onChoiceChange: (choice: CheckoutChoice) => void;
  // order.sellOnCredit / order.createGift: without them the choice is not offered.
  canCredit: boolean;
  canGift: boolean;
  onDiscount: () => void;
  onLineDiscount: (key: string) => void;
  onRemoveLine: (key: string) => void;
  onFinish: () => void;
  // Set while the cart holds the new pieces of an exchange: the choices give way to the difference.
  exchange?: ExchangeCartState | null;
  // The bottom sheet draws its own title.
  hideTitle?: boolean;
  className?: string;
}

const TITLE_ID = "pos-cart-title";

// The sale: beside the grid from 1000px, inside the bottom sheet below that; the choices decide what the one button does.
export function CartPanel({
  cart,
  scanFlash,
  isSubmitting,
  choice,
  onChoiceChange,
  canCredit,
  canGift,
  onDiscount,
  onLineDiscount,
  onRemoveLine,
  onFinish,
  exchange = null,
  hideTitle = false,
  className,
}: CartPanelProps) {
  const t = useTranslations("sell");
  const formatMoney = useMoneyFormatter();
  const { confirm, dialog } = useConfirm("pos-cart-clear-confirm");

  const { totals } = cart;
  const isGift = canGift && choice.gift;
  const onCredit = canCredit && !isGift && choice.payment === "credit";
  // Line and whole-sale discounts as one row, summed in cents — never in floats.
  const discountCents = toCents(totals.itemDiscountTotal) + toCents(totals.orderDiscountAmount);
  const isExchange = exchange !== null;
  const exchangeBlocked = isExchange && (exchange.credit === null || hasQuickSellLines(cart.lines));
  const canFinish = !cart.isEmpty && !isSubmitting && !exchangeBlocked;
  const differenceCents = isExchange ? exchangeDifferenceCents(totals.total, exchange.credit ?? "0") : 0;
  const side = exchangeSide(differenceCents);

  const finish = isExchange
    ? { label: t("exchange.finish"), icon: <Repeat aria-hidden="true" /> }
    : isGift
      ? { label: t("checkout.finishGift"), icon: <Gift aria-hidden="true" /> }
      : choice.channel === "WHATSAPP"
        ? { label: t("checkout.finishWhatsapp"), icon: <MessageCircle aria-hidden="true" /> }
        : onCredit
          ? { label: t("checkout.finishCredit"), icon: <Clock aria-hidden="true" /> }
          : { label: t("checkout.finishSale", { total: formatMoney(totals.total) }), icon: null };

  function clearCart() {
    confirm({
      title: "sell.screen.clearConfirmTitle",
      consequences: [t("screen.clearConfirmConsequence")],
      confirmLabel: "sell.screen.clearConfirmYes",
      onConfirm: async () => cart.clear(),
    });
  }

  return (
    <section
      aria-labelledby={hideTitle ? undefined : TITLE_ID}
      aria-label={hideTitle ? t("screen.cartTitle") : undefined}
      className={cn(SCREEN_PANEL, "flex min-h-0 flex-col", className)}
      data-test-selector="pos-cart-panel"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-4 desk:px-5 desk:pt-5">
        <div className="flex min-w-0 items-baseline gap-2">
          {!hideTitle && <SectionTitle id={TITLE_ID}>{t("screen.cartTitle")}</SectionTitle>}
          <Typography variant="caption" tone="muted" className="truncate" data-test-selector="pos-cart-count">
            {t("search.cartCount", { count: totals.itemCount })}
          </Typography>
        </div>
        {!cart.isEmpty && (
          <Button
            variant="quiet"
            icon={<Trash2 aria-hidden="true" />}
            onClick={clearCart}
            data-testid="pos-cart-clear"
            className="hit-area shrink-0 px-0 text-danger-700 [&_svg]:size-3.5 hover:bg-transparent hover:text-danger-800 focus-visible:bg-transparent focus-visible:text-danger-900"
          >
            {t("screen.clear")}
          </Button>
        )}
      </div>

      {exchange && <ExchangeBanner exchange={exchange} />}

      {cart.isEmpty ? (
        <div
          className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-4"
          data-test-selector="pos-cart-empty"
        >
          <EmptyState
            icon="barcode"
            title={isExchange ? "sell.exchange.emptyTitle" : "sell.cart.emptyTitle"}
            hint={isExchange ? "sell.exchange.emptyHint" : "sell.cart.emptyHint"}
          />
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-4 desk:px-5" data-test-selector="pos-cart">
          {cart.lines.map((line) => (
            <CartLine
              key={line.key}
              line={line}
              flash={scanFlash.lineKey === line.key ? scanFlash.flash : null}
              onDiscount={isGift ? undefined : () => onLineDiscount(line.key)}
              onQuantityChange={(quantity) => cart.setQuantity(line.key, quantity)}
              onRemove={() => onRemoveLine(line.key)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-line px-4 pb-4 pt-3 desk:px-5 desk:pb-5">
        {!isGift && (
          <dl className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Typography as="dt" variant="small" tone="muted">
                {t("screen.subtotal")}
              </Typography>
              <Typography as="dd" variant="small" weight="semibold" className="tabular-nums">
                {formatMoney(totals.subtotal)}
              </Typography>
            </div>
            <div className="flex items-center justify-between">
              <Typography as="dt" variant="small" tone="muted" className="flex items-center gap-1">
                {t("screen.discount")}
                <IconButton
                  label={t("screen.editDiscount")}
                  icon={<Pencil aria-hidden="true" />}
                  onClick={onDiscount}
                  disabled={cart.isEmpty}
                  data-testid="pos-order-discount-button"
                  className="hit-area size-5 [&_svg]:size-4"
                />
              </Typography>
              <Typography
                as="dd"
                variant="small"
                weight="semibold"
                tone={discountCents > 0 ? "success" : "ink"}
                className="tabular-nums"
              >
                {formatMoney(fromCents(-discountCents))}
              </Typography>
            </div>
          </dl>
        )}

        {isExchange ? (
          <>
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Typography as="dt" variant="small" tone="muted">
                  {t("exchange.newTotal")}
                </Typography>
                <Typography
                  as="dd"
                  variant="small"
                  weight="semibold"
                  className="tabular-nums"
                  data-test-selector="pos-cart-total"
                >
                  {formatMoney(totals.total)}
                </Typography>
              </div>
              <div className="flex items-center justify-between">
                <Typography as="dt" variant="small" tone="muted">
                  {t("exchange.returnedValue")}
                </Typography>
                <Typography as="dd" variant="small" weight="semibold" tone="success" className="tabular-nums">
                  {exchange.credit === null ? "…" : formatMoney(fromCents(-toCents(exchange.credit)))}
                </Typography>
              </div>
            </dl>
            {/* Which way the money goes, on its own band: the one figure the cashier says out loud. */}
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-control px-3.5 py-2.5",
                side === "shop" ? "bg-warning-50" : "bg-primary-50",
              )}
              data-test-selector="pos-exchange-difference"
            >
              <Typography as="span" variant="body" weight="bold" tone={side === "shop" ? "inherit" : "brand"}>
                {t(`exchange.side.${side}`)}
              </Typography>
              <Typography as="span" variant="h2" weight="bold" className="tabular-nums">
                {formatMoney(fromCents(Math.abs(differenceCents)))}
              </Typography>
            </div>
            {hasQuickSellLines(cart.lines) && <Alert tone="warning">{t("exchange.noQuickSell")}</Alert>}
          </>
        ) : (
          /* What the customer pays, on its own band so it is the first thing an eye finds. */
          <div className="flex items-center justify-between gap-3 rounded-control bg-primary-50 px-3.5 py-2.5">
            <Typography as="span" variant="body" weight="bold" tone="brand">
              {isGift ? t("checkout.giftTotal") : t("checkout.total")}
            </Typography>
            <Typography
              as="span"
              variant="h2"
              weight="bold"
              className="tabular-nums"
              data-test-selector="pos-cart-total"
            >
              {formatMoney(isGift ? 0 : totals.total)}
            </Typography>
          </div>
        )}

        {!isExchange && (
          <div className="flex flex-col gap-2.5" data-test-selector="pos-checkout-choice">
            <div className="flex flex-wrap gap-2">
              <SegmentedControl<SaleChannel>
                label={t("checkout.channelLabel")}
                value={choice.channel}
                onChange={(channel) => onChoiceChange({ ...choice, channel })}
                options={[
                  { value: "STORE", label: t("checkout.channelStore") },
                  { value: "WHATSAPP", label: t("checkout.channelWhatsapp") },
                ]}
                data-testid="pos-checkout-channel"
              />
              {canCredit && !isGift && (
                <SegmentedControl<SalePayment>
                  label={t("checkout.paymentLabel")}
                  value={choice.payment}
                  onChange={(payment) => onChoiceChange({ ...choice, payment })}
                  options={[
                    { value: "paid", label: t("checkout.paymentPaid") },
                    { value: "credit", label: t("checkout.paymentCredit") },
                  ]}
                  data-testid="pos-checkout-payment"
                />
              )}
            </div>
            {canGift && (
              <Switch
                label={t("checkout.giftLabel")}
                checked={choice.gift}
                onCheckedChange={(gift) => onChoiceChange({ ...choice, gift })}
                data-testid="pos-checkout-gift"
              />
            )}
          </div>
        )}

        {/* 52px and bold: the one button on the screen that takes money. */}
        <Button
          onClick={onFinish}
          disabled={!canFinish}
          isLoading={isSubmitting}
          icon={finish.icon}
          data-testid="pos-checkout-button"
          className="w-full"
        >
          {isSubmitting ? t("checkout.submitting") : finish.label}
        </Button>
      </div>
      {dialog}
    </section>
  );
}
