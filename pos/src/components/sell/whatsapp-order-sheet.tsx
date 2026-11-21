"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
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
import { Alert, Button } from "@store/ui";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { SHEET_ACTION_TALL } from "@/components/sell/sheet-styles";
import { CustomerForm } from "@/components/sell/customer-form";
import type { OrderCustomerDraft } from "@/types/customer";

interface WhatsappOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: string;
  isSubmitting: boolean;
  // A backend error code from the failed save, shown inside the sheet that covers the screen.
  errorCode: string | null;
  onSubmit: (customer: OrderCustomerDraft) => void;
}

// The open cart as a WHATSAPP order: opens NEW with no stock taken until it is prepared (spec.md "Stock deduction"); a sheet so the cart is never left behind.
export function WhatsappOrderSheet({
  open,
  onOpenChange,
  total,
  isSubmitting,
  errorCode,
  onSubmit,
}: WhatsappOrderSheetProps) {
  const t = useTranslations("sell.whatsapp");
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

  function submit(values: OrderCustomerFormValues) {
    onSubmit(toCustomerDraft(values));
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
