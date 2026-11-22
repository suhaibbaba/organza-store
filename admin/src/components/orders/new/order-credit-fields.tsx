"use client";

import { useLocale, useTranslations } from "next-intl";
import { Checkbox, FormField, Switch, Typography } from "@store/ui";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import { CustomerPicker } from "@/components/customers/customer-picker";
import { MoneyField } from "@/components/fields/money-field";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { localize } from "@/lib/i18n-content";
import type { OrderCreditDraft, OrderDraftLine } from "@/types/order";

interface OrderCreditFieldsProps {
  credit: OrderCreditDraft;
  onChange: (patch: Partial<OrderCreditDraft>) => void;
  lines: readonly OrderDraftLine[];
  total: string;
  // Only a counter sale picks its customer here; an online order's customer is its contact.
  atCounter: boolean;
  showErrors: boolean;
}

// An order on credit: who owes it, what they paid now (maybe nothing), and which pieces stay in the shop.
export function OrderCreditFields({ credit, onChange, lines, total, atCounter, showErrors }: OrderCreditFieldsProps) {
  const t = useTranslations("orders.new.credit");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const paid = Number(credit.paidNow || 0);
  const owed = Math.max(0, Number(total) - paid);

  return (
    <div className="flex flex-col divide-y divide-line">
      <div className="pb-4">
        <FormField label="orders.new.credit.toggle" htmlFor="order-on-credit" note="orders.new.credit.toggleHint">
          <Switch
            id="order-on-credit"
            data-testid={fieldTestSelector("order-on-credit")}
            label={t("toggle")}
            hideLabel
            checked={credit.onCredit}
            onCheckedChange={(onCredit) => onChange({ onCredit })}
          />
        </FormField>
      </div>

      {credit.onCredit && (
        <div className="flex flex-col gap-4 pt-4">
          {atCounter ? (
            <div className="flex flex-col gap-1.5">
              <Typography variant="label" as="span">
                {t("customer")}
              </Typography>
              <CustomerPicker value={credit.customer} onChange={(customer) => onChange({ customer })} />
              {showErrors && !credit.customer && (
                <Typography
                  variant="caption"
                  tone="error"
                  role="alert"
                  data-test-selector="field-error-order-credit-customer"
                >
                  {t("customerRequired")}
                </Typography>
              )}
            </div>
          ) : (
            <Typography variant="caption" tone="muted" as="p" data-test-selector="order-credit-online-customer">
              {t("onlineCustomerHint")}
            </Typography>
          )}

          <FormField
            label="orders.new.credit.paidNow"
            htmlFor="order-paid-now"
            optional
            note="orders.new.credit.paidNowHint"
            error={showErrors && paid > Number(total) ? { type: "max" } : undefined}
            errorKey="orders.new.credit.paidNowTooMuch"
          >
            <MoneyField
              id="order-paid-now"
              data-test-selector={fieldTestSelector("order-paid-now")}
              placeholder={t("paidNowPlaceholder")}
              value={credit.paidNow}
              onChange={(event) => onChange({ paidNow: event.target.value })}
            />
          </FormField>
          <div className="flex items-center justify-between gap-3 rounded-panel bg-sunken px-4 py-3">
            <Typography variant="body" tone="muted" as="span">
              {t("remaining")}
            </Typography>
            <Typography
              variant="h4"
              as="span"
              className="tabular-nums text-danger-700"
              data-test-selector="order-credit-remaining"
            >
              {formatMoney(owed)}
            </Typography>
          </div>

          {lines.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <Typography as="legend" variant="label" className="mb-1">
                {t("keptTitle")}
              </Typography>
              <Typography variant="caption" tone="muted" as="p">
                {t("keptHint")}
              </Typography>
              <div className="flex flex-col divide-y divide-line rounded-panel border border-line">
                {lines.map((line) => (
                  <div key={line.key} className="px-3 py-2.5">
                    <Checkbox
                      id={`order-kept-${line.key}`}
                      data-testid={testSelectorFor("order-kept", line.key)}
                      label={`${localize(line.name, locale)}${line.variantName ? ` · ${localize(line.variantName, locale)}` : ""}${line.quantity > 1 ? ` ×${line.quantity}` : ""}`}
                      checked={credit.keptKeys.includes(line.key)}
                      onCheckedChange={(checked) =>
                        onChange({
                          keptKeys: checked
                            ? [...credit.keptKeys, line.key]
                            : credit.keptKeys.filter((key) => key !== line.key),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
