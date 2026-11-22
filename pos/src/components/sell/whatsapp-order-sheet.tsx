"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Send } from "lucide-react";
import type { CustomerSuggestion } from "@store/shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { suggestionToFormValues } from "@/lib/customer";
import {
  DEFAULT_ORDER_CUSTOMER_VALUES,
  orderCustomerFormSchema,
  toCustomerDraft,
  type OrderCustomerFormValues,
} from "@/lib/validation/customer";
import { Alert, Button, Checkbox, Switch } from "@store/ui";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import type { CartLine } from "@/types/cart";
import { NumericInput } from "@/components/fields/numeric-input";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { SHEET_ACTION_TALL } from "@/components/sell/sheet-styles";
import { CustomerForm } from "@/components/sell/customer-form";
import type { CreditCheckout, OrderCustomerDraft } from "@/types/customer";

interface WhatsappOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: readonly CartLine[];
  total: string;
  isSubmitting: boolean;
  // A backend error code from the failed save, shown inside the sheet that covers the screen.
  errorCode: string | null;
  // Offered when the cashier holds order.sellOnCredit.
  canCredit: boolean;
  onSubmit: (customer: OrderCustomerDraft, credit?: CreditCheckout) => void;
}

// The open cart as a WHATSAPP order: opens NEW with no stock taken until it is prepared (spec.md "Stock deduction"); a sheet so the cart is never left behind.
export function WhatsappOrderSheet({
  open,
  onOpenChange,
  lines,
  total,
  isSubmitting,
  errorCode,
  canCredit,
  onSubmit,
}: WhatsappOrderSheetProps) {
  const t = useTranslations("sell.whatsapp");
  const tCredit = useTranslations("sell.credit");
  const [onCredit, setOnCredit] = useState(false);
  const [paidNow, setPaidNow] = useState("");
  const [keptKeys, setKeptKeys] = useState<string[]>([]);
  const locale = useLocale();
  const paid = Number(paidNow || 0);
  const tooMuch = onCredit && paid > Number(total);
  const translateError = useTranslateError();
  const formatMoney = useMoneyFormatter();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<OrderCustomerFormValues>({
    resolver: zodResolver(orderCustomerFormSchema),
    defaultValues: DEFAULT_ORDER_CUSTOMER_VALUES,
  });

  // Closing keeps what was typed (the cashier is fixing the cart); a saved order unmounts this with the selling screen.

  function applySuggestion(suggestion: CustomerSuggestion) {
    reset(suggestionToFormValues(suggestion, getValues()), { keepDefaultValues: true });
  }

  // On credit the order's customer is the one who owes it; a kept piece waits in the shop instead of going out.
  function submit(values: OrderCustomerFormValues) {
    if (tooMuch) {
      return;
    }
    onSubmit(
      toCustomerDraft(values),
      canCredit && onCredit
        ? { paidNow, keptKeys: keptKeys.filter((key) => lines.some((line) => line.key === key)) }
        : undefined,
    );
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      name="whatsapp-order"
      title={t("title")}
      description={t("subtitle")}
      className="max-h-[92dvh]"
      headerClassName="pb-0"
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <CustomerForm
            register={register}
            control={control}
            setValue={setValue}
            errors={errors}
            onPickSuggestion={applySuggestion}
          />
          {canCredit && (
            <section
              className="mt-5 flex flex-col gap-3 rounded-panel border border-line p-4"
              data-test-selector="pos-whatsapp-credit"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex flex-col gap-0.5">
                  <span className="text-value font-medium text-ink">{t("creditToggle")}</span>
                  <span className="text-micro text-ink-muted">{t("creditHint")}</span>
                </span>
                <Switch
                  data-testid={fieldTestSelector("pos-whatsapp-on-credit")}
                  label={t("creditToggle")}
                  hideLabel
                  checked={onCredit}
                  onCheckedChange={setOnCredit}
                />
              </div>
              {onCredit && (
                <>
                  <label htmlFor="pos-whatsapp-paid-now" className="text-label text-ink">
                    {tCredit("paidNow")}
                  </label>
                  <NumericInput
                    id="pos-whatsapp-paid-now"
                    data-testid={fieldTestSelector("pos-whatsapp-paid-now")}
                    allowDecimal
                    dir="ltr"
                    className="h-12 text-lg tabular-nums"
                    placeholder="0"
                    value={paidNow}
                    onChange={(event) => setPaidNow(event.target.value)}
                  />
                  <p className={tooMuch ? "text-label text-danger-700" : "text-micro text-ink-muted"}>
                    {tooMuch ? tCredit("paidNowTooMuch") : tCredit("paidNowHint")}
                  </p>
                  <div className="flex items-center justify-between gap-3 rounded-panel bg-sunken px-4 py-3">
                    <span className="text-value text-ink-muted">{tCredit("remaining")}</span>
                    <span
                      className="text-xl font-bold tabular-nums text-danger-700"
                      data-test-selector="pos-whatsapp-credit-remaining"
                    >
                      {formatMoney(Math.max(0, Number(total) - paid))}
                    </span>
                  </div>
                  <span className="mt-2 text-label font-medium text-ink">{tCredit("keptTitle")}</span>
                  <span className="text-micro text-ink-muted">{tCredit("keptHint")}</span>
                  <ul className="flex flex-col divide-y divide-line rounded-panel border border-line">
                    {lines.map((line) => {
                      const variant = line.variantName ? ` · ${localize(line.variantName, locale)}` : "";
                      return (
                        <li key={line.key} className="px-4 py-3">
                          <Checkbox
                            id={`pos-whatsapp-kept-${line.key}`}
                            data-testid={testSelectorFor("pos-whatsapp-kept", line.key)}
                            label={`${localize(line.name, locale)}${variant}${line.quantity > 1 ? ` ×${line.quantity}` : ""}`}
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
                </>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-line px-5 pt-4">
          {errorCode && (
            <Alert tone="danger" data-testid="alert-destructive">
              {translateError(errorCode)}
            </Alert>
          )}

          <div className="flex items-center justify-between text-lg font-bold text-ink">
            <span>{t("total")}</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </div>

          <Button
            type="submit"
            data-testid="pos-whatsapp-order-submit"
            isLoading={isSubmitting}
            icon={<Send aria-hidden="true" />}
            className={`${SHEET_ACTION_TALL} w-full`}
          >
            {isSubmitting ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
