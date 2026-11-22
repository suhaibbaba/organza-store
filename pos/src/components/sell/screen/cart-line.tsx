"use client";

import { useLocale, useTranslations } from "next-intl";
import { Percent, Trash2 } from "lucide-react";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { Badge, IconButton, QuantityStepper, Typography } from "@store/ui";
import { MIN_CART_QUANTITY, SCAN_FLASH_MS } from "@/constants/pos";
import { SELL_CART_THUMB_SIZES } from "@/constants/images";
import { useDiscountLabel } from "@/hooks/use-discount-label";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { lineTotal } from "@/lib/cart";
import { localize } from "@/lib/i18n-content";
import { cn } from "@/lib/utils";
import { ProductThumb } from "@/components/sell/product-thumb";
import type { CartLine as CartLineData } from "@/types/cart";
import type { ScanFlash } from "@/types/feedback";

interface CartLineProps {
  line: CartLineData;
  // Set for the line a scan just landed on (hooks/use-scan-flash.ts).
  flash: ScanFlash | null;
  // Absent on a gift: it is priced at zero, so a discount would describe money that never existed.
  onDiscount?: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

// A variant's name is its option values joined by " / " (backend lib/variantCombo.ts); each is drawn as a badge.
const VARIANT_NAME_SEPARATOR = " / ";

const LINE_TOOL = "hit-area";

// Removing asks nothing: the selling screen offers Undo in a toast instead, so a busy till never waits on a question.
export function CartLine({ line, flash, onDiscount, onQuantityChange, onRemove }: CartLineProps) {
  const t = useTranslations("sell");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const discountLabel = useDiscountLabel();

  const name = localize(line.name, locale);
  const variantName = line.variantName ? localize(line.variantName, locale) : null;
  const fullName = variantName ? `${name} — ${variantName}` : name;
  const chips = variantName ? variantName.split(VARIANT_NAME_SEPARATOR).filter(Boolean) : [];
  const appliedDiscount = discountLabel(line.discountType, line.discountValue);

  return (
    <li
      className={cn(
        "relative flex items-start gap-3 border-b border-line py-3 transition-colors last:border-b-0",
        flash && "-mx-2 rounded-control bg-primary-50 px-2",
      )}
      data-test-selector={testSelectorFor("pos-cart-line", line.key)}
    >
      <ProductThumb
        src={line.imageUrl}
        alt={name}
        sizes={SELL_CART_THUMB_SIZES}
        className="size-14 rounded-photo bg-sunken"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start gap-1">
          <Typography variant="small" weight="semibold" className="min-w-0 flex-1 break-words">
            {name}
          </Typography>
          <IconButton
            label={t("cart.remove", { name: fullName })}
            icon={<Trash2 aria-hidden="true" />}
            tone="danger"
            onClick={onRemove}
            data-testid={testSelectorFor("pos-cart-line-remove", line.key)}
            className={cn(LINE_TOOL, "-mt-2 -me-2")}
          />
        </div>
        {(chips.length > 0 || line.quickSell) && (
          <span className="flex flex-wrap gap-1">
            {line.quickSell && <Badge tone="warning">{t("cart.quickSold")}</Badge>}
            {chips.map((chip) => (
              <Badge key={chip} tone="neutral">
                {chip}
              </Badge>
            ))}
          </span>
        )}
        {appliedDiscount && onDiscount && (
          <Typography variant="caption" tone="success" weight="medium">
            {t("cart.discountValue", { value: appliedDiscount })}
          </Typography>
        )}
        <div className="mt-1 flex w-full items-center gap-2">
          <QuantityStepper
            name={line.key}
            testName="pos-quantity"
            value={line.quantity}
            min={MIN_CART_QUANTITY}
            max={Math.max(MIN_CART_QUANTITY, line.availableStock)}
            onChange={onQuantityChange}
            onBelowMin={onRemove}
            decreaseLabel={t("cart.decrease", { name: fullName })}
            increaseLabel={t("cart.increase", { name: fullName })}
            valueLabel={t("cart.quantity", { name: fullName })}
            className="w-32"
          />
          {onDiscount && (
            <IconButton
              label={t("cart.discountFor", { name: fullName })}
              icon={<Percent aria-hidden="true" />}
              onClick={onDiscount}
              data-testid={testSelectorFor("pos-cart-line-discount", line.key)}
              className={cn(LINE_TOOL, appliedDiscount && "text-success-700")}
            />
          )}
          <Typography as="span" variant="body" weight="bold" className="ms-auto tabular-nums">
            {formatMoney(onDiscount ? lineTotal(line) : 0)}
          </Typography>
        </div>
      </div>

      {/* Drains over the window in which the same barcode is ignored (use-scan-flash). */}
      {flash && (
        <span
          key={flash.token}
          className="animate-scan-flash-bar absolute bottom-0 start-0 h-1 w-full rounded-pill bg-primary-600"
          style={{ animationDuration: `${SCAN_FLASH_MS}ms` }}
          aria-hidden="true"
        />
      )}
    </li>
  );
}
