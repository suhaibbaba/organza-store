"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Alert, Button, Checkbox, FormField, Typography } from "@store/ui";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { CustomerPicker, type PickedCustomer } from "@/components/sell/customer-picker";
import { NumericInput } from "@/components/fields/numeric-input";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
import { useTranslateError } from "@/hooks/use-translate-error";
import { localize } from "@/lib/i18n-content";
import type { CartLine } from "@/types/cart";
import type { CreditCheckout } from "@/types/customer";

interface CreditOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: readonly CartLine[];
  total: string;
  isSubmitting: boolean;
  errorCode: string | null;
  onConfirm: (credit: CreditCheckout) => void;
}

// Selling on credit at the counter: pick or add the customer, take what they pay now (maybe nothing), mark pieces kept.
export function CreditOrderSheet(props: CreditOrderSheetProps) {
  // Mounted only while open, so every sale starts blank.
  return props.open ? <CreditOrderForm {...props} /> : null;
}

function CreditOrderForm({
  open,
  onOpenChange,
  lines,
  total,
  isSubmitting,
  errorCode,
  onConfirm,
}: CreditOrderSheetProps) {
  const t = useTranslations("sell.credit");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const currency = useCurrencySymbol();
  const translateError = useTranslateError();
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [paidNow, setPaidNow] = useState("");
  const [keptKeys, setKeptKeys] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const paid = Number(paidNow || 0);
  const tooMuch = paid > Number(total);
  const remaining = Math.max(0, Number(total) - paid);

  function confirm() {
    setSubmitted(true);
    if (!customer || tooMuch) {
      return;
    }
    onConfirm({ customerId: customer.id, paidNow, keptKeys });
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      name="credit-order"
      className="max-h-[92dvh]"
      headerClassName="pb-0"
      title={
        <span className="flex items-center gap-2">
          <Clock className="size-5 shrink-0 text-danger-700" aria-hidden="true" />
          {t("title")}
        </span>
      }
      description={t("subtitle")}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4">
        <CustomerPicker value={customer} onChange={setCustomer} showRequired={submitted} name="credit" />

        <section className="flex flex-col gap-2">
          <FormField
            label="sell.credit.paidNow"
            htmlFor="pos-credit-paid-now"
            optional
            note="sell.credit.paidNowHint"
            error={tooMuch ? { type: "max" } : undefined}
            errorKey="sell.credit.paidNowTooMuch"
          >
            <NumericInput
              id="pos-credit-paid-now"
              data-testid={fieldTestSelector("pos-credit-paid-now")}
              allowDecimal
              dir="ltr"
              suffix={currency}
              className=" tabular-nums"
              placeholder="0"
              value={paidNow}
              onChange={(event) => setPaidNow(event.target.value)}
            />
          </FormField>
          <div className="flex items-center justify-between gap-3 rounded-panel bg-sunken px-4 py-3">
            <Typography as="span" variant="body" tone="muted">
              {t("remaining")}
            </Typography>
            <Typography
              as="span"
              variant="h2"
              weight="bold"
              tone="error"
              className="tabular-nums"
              data-test-selector="pos-credit-remaining"
            >
              {formatMoney(remaining)}
            </Typography>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Typography as="h3" variant="small" weight="medium">
            {t("keptTitle")}
          </Typography>
          <Typography variant="caption" tone="muted">
            {t("keptHint")}
          </Typography>
          <ul className="flex flex-col divide-y divide-line rounded-panel border border-line">
            {lines.map((line) => {
              const name = localize(line.name, locale);
              const variant = line.variantName ? ` · ${localize(line.variantName, locale)}` : "";
              return (
                <li key={line.key} className="px-4 py-3">
                  <Checkbox
                    id={`pos-credit-kept-${line.key}`}
                    data-testid={testSelectorFor("pos-credit-kept", line.key)}
                    label={`${name}${variant}${line.quantity > 1 ? ` ×${line.quantity}` : ""}`}
                    checked={keptKeys.includes(line.key)}
                    onCheckedChange={(checked) =>
                      setKeptKeys((current) =>
                        checked ? [...current, line.key] : current.filter((key) => key !== line.key),
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-5 pt-4">
        {errorCode && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(errorCode)}
          </Alert>
        )}
        <div className="flex items-stretch gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            data-testid="pos-credit-cancel"
            disabled={isSubmitting}
            className={"min-w-28 flex-1"}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={confirm}
            data-testid="pos-credit-confirm"
            isLoading={isSubmitting}
            icon={<Clock aria-hidden="true" />}
            className={"min-w-0 flex-1"}
          >
            {isSubmitting ? t("saving") : t("confirm")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
