"use client";

import { useTranslations } from "next-intl";
import { ScanLine } from "lucide-react";
import { CartLineRow } from "@/components/sell/cart-line-row";
import type { Cart } from "@/hooks/use-cart";
import type { ScanFlashState } from "@/hooks/use-scan-flash";

interface CartPanelProps {
  cart: Cart;
  // Which line a scan just landed on, if any (hooks/use-scan-flash.ts).
  scanFlash: ScanFlashState;
  onLineDiscountClick: (key: string) => void;
}

// The open sale. Empty is the screen's resting state between customers, so
// it says what to do next rather than just being blank.
export function CartPanel({ cart, scanFlash, onLineDiscountClick }: CartPanelProps) {
  const t = useTranslations("sell.cart");

  if (cart.isEmpty) {
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center"
        data-test-selector="pos-cart-empty"
      >
        <ScanLine className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-base font-medium">{t("emptyTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" data-test-selector="pos-cart">
      {cart.lines.map((line) => (
        <CartLineRow
          key={line.key}
          line={line}
          flash={scanFlash.lineKey === line.key ? scanFlash.flash : null}
          onQuantityChange={(quantity) => cart.setQuantity(line.key, quantity)}
          onRemove={() => cart.removeLine(line.key)}
          onDiscountClick={() => onLineDiscountClick(line.key)}
        />
      ))}
    </ul>
  );
}
