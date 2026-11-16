"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import type { CustomerSuggestion } from "@organza/shared/types/order";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { suggestionToFormValues } from "@/lib/customer";
import {
  DEFAULT_ORDER_CUSTOMER_VALUES,
  orderCustomerFormSchema,
  toCustomerDraft,
  type OrderCustomerFormValues,
} from "@/lib/validation/customer";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { CustomerForm } from "@/components/sell/customer-form";
import type { OrderCustomerDraft } from "@/types/customer";

interface WhatsappOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: string;
  isSubmitting: boolean;
  // A backend error code from the failed save, or null. Rendered here rather
  // than behind the sheet, where the cashier would never see it.
  errorCode: string | null;
  onSubmit: (customer: OrderCustomerDraft) => void;
}

// Turning the open cart into a WhatsApp order: the same items, sent to
// someone instead of handed over. The order is filed under the WHATSAPP
// channel and opens NEW with no stock taken off the shelf — it commits when
// someone starts preparing it (spec.md "Stock deduction") — and its money is
// collected from the delivery company later.
//
// A sheet rather than a separate page so the cart is never left behind: the
// cashier can close it, add the item they forgot, and reopen it with what
// they had already typed still in place.
export function WhatsappOrderSheet({
  open,
  onOpenChange,
  total,
  isSubmitting,
  errorCode,
  onSubmit,
}: WhatsappOrderSheetProps) {
  const t = useTranslations("sell.whatsapp");
  const tCommon = useTranslations("common");
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

  // Closing the sheet deliberately keeps what was typed — the cashier is
  // usually stepping back to fix the cart and will reopen it. A saved order
  // takes the whole selling screen away (see SellScreen), unmounting this
  // with it, so the next order starts from empty fields without anything
  // having to remember to clear them.

  function applySuggestion(suggestion: CustomerSuggestion) {
    reset(suggestionToFormValues(suggestion, getValues()), { keepDefaultValues: true });
  }

  function submit(values: OrderCustomerFormValues) {
    onSubmit(toCustomerDraft(values));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent name="whatsapp-order" side="bottom" closeLabel={tCommon("close")} className="max-h-[92dvh]">
        <SheetHeader className="pb-0">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("subtitle")}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
          {/* The fields scroll; the total and the one button that saves the
              order stay pinned under the thumb. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            <CustomerForm
              register={register}
              control={control}
              setValue={setValue}
              errors={errors}
              onPickSuggestion={applySuggestion}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-5 pt-4">
            {errorCode && <Alert variant="destructive">{translateError(errorCode)}</Alert>}

            <div className="flex items-center justify-between text-lg font-bold">
              <span>{t("total")}</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>

            <Button type="submit" data-test-selector="pos-whatsapp-order-submit" disabled={isSubmitting} className="h-14 w-full text-base">
              {isSubmitting ? <Spinner /> : <Send aria-hidden="true" />}
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
