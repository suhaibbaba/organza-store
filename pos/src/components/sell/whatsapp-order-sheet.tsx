"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Send } from "lucide-react";
import type { CustomerSuggestion } from "@store/shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
import { useTranslateError } from "@/hooks/use-translate-error";
import { suggestionToFormValues } from "@/lib/customer";
import {
  DEFAULT_ORDER_CUSTOMER_VALUES,
  orderCustomerFormSchema,
  toCustomerDraft,
  type OrderCustomerFormValues,
} from "@/lib/validation/customer";
import { Alert, Button, Checkbox, FormField, Typography } from "@store/ui";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import { localize } from "@/lib/i18n-content";
import type { CartLine } from "@/types/cart";
import { NumericInput } from "@/components/fields/numeric-input";
import { BottomSheet } from "@/components/sell/bottom-sheet";
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
  // Chosen on the cart before this opens: owed by this customer, or given away.
  onCredit: boolean;
  gift: boolean;
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
  onCredit,
  gift,
  onSubmit,
}: WhatsappOrderSheetProps) {
  const t = useTranslations("sell.whatsapp");
  const tCredit = useTranslations("sell.credit");
  const [paidNow, setPaidNow] = useState("");
  const [keptKeys, setKeptKeys] = useState<string[]>([]);
  const locale = useLocale();
  const paid = Number(paidNow || 0);
  const tooMuch = onCredit && paid > Number(total);
  const translateError = useTranslateError();
  const formatMoney = useMoneyFormatter();
  const currency = useCurrencySymbol();

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
      onCredit ? { paidNow, keptKeys: keptKeys.filter((key) => lines.some((line) => line.key === key)) } : undefined,
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
          {onCredit && (
            <section
              className="mt-5 flex flex-col gap-3 rounded-panel border border-line p-4"
              data-test-selector="pos-whatsapp-credit"
            >
              <Typography as="h3" variant="body" weight="medium">
                {t("creditToggle")}
              </Typography>
              <FormField
                label="sell.credit.paidNow"
                htmlFor="pos-whatsapp-paid-now"
                optional
                note="sell.credit.paidNowHint"
                error={tooMuch ? { type: "max" } : undefined}
                errorKey="sell.credit.paidNowTooMuch"
              >
                <NumericInput
                  id="pos-whatsapp-paid-now"
                  data-testid={fieldTestSelector("pos-whatsapp-paid-now")}
                  allowDecimal
                  dir="ltr"
                  suffix={currency || undefined}
                  className=" tabular-nums"
                  placeholder="0"
                  value={paidNow}
                  onChange={(event) => setPaidNow(event.target.value)}
                />
              </FormField>
              <div className="flex items-center justify-between gap-3 rounded-panel bg-sunken px-4 py-3">
                <Typography as="span" variant="body" tone="muted">
                  {tCredit("remaining")}
                </Typography>
                <Typography
                  as="span"
                  variant="h2"
                  weight="bold"
                  tone="error"
                  className="tabular-nums"
                  data-test-selector="pos-whatsapp-credit-remaining"
                >
                  {formatMoney(Math.max(0, Number(total) - paid))}
                </Typography>
              </div>
              <Typography as="h4" variant="small" weight="medium" className="mt-2">
                {tCredit("keptTitle")}
              </Typography>
              <Typography variant="caption" tone="muted">
                {tCredit("keptHint")}
              </Typography>
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
            </section>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-line px-5 pt-4">
          {errorCode && (
            <Alert tone="danger" data-testid="alert-destructive">
              {translateError(errorCode)}
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <Typography as="span" variant="h3" weight="bold">
              {t("total")}
            </Typography>
            <Typography as="span" variant="h3" weight="bold" className="tabular-nums">
              {formatMoney(gift ? 0 : total)}
            </Typography>
          </div>

          <Button
            type="submit"
            data-testid="pos-whatsapp-order-submit"
            isLoading={isSubmitting}
            icon={<Send aria-hidden="true" />}
            className={"w-full"}
          >
            {isSubmitting ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
