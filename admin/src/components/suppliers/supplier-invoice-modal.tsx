"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, DatePicker, FormField, Input, Modal, Switch, Textarea, Typography, useToast } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { SUPPLIER_INVOICE_NOTE_MAX_LENGTH, SUPPLIER_INVOICE_NUMBER_MAX_LENGTH } from "@store/shared/constants/supplier";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { useSession } from "@/components/providers/session-provider";
import { MoneyField } from "@/components/fields/money-field";
import { useCreateSupplierInvoiceMutation, useUpdateSupplierInvoiceMutation } from "@/hooks/use-suppliers";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { toLocalDateString } from "@/lib/report-range";
import type { SupplierInvoiceTarget } from "@/types/supplier";

const FORM_ID = "supplier-invoice-form";
const INVALID = { type: "invalid" } as const;

interface SupplierInvoiceModalProps {
  supplierId: string;
  target: SupplierInvoiceTarget | null;
  onClose: () => void;
}

export function SupplierInvoiceModal(props: SupplierInvoiceModalProps) {
  return props.target ? <InvoiceForm {...props} target={props.target} /> : null;
}

// An invoice is what the shop owes for a delivery; anything paid on the spot is its first payment.
function InvoiceForm({ supplierId, target, onClose }: SupplierInvoiceModalProps & { target: SupplierInvoiceTarget }) {
  const t = useTranslations("suppliers.invoiceForm");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const translateError = useTranslateError();
  const formatMoney = useMoneyFormatter();
  const { user } = useSession();
  const editing = target.mode === "edit" ? target.invoice : undefined;
  const canPay = !editing && can(user, "supplier.pay");
  const [invoiceNumber, setInvoiceNumber] = useState(editing?.invoiceNumber ?? "");
  const [invoiceDate, setInvoiceDate] = useState(editing?.invoiceDate ?? toLocalDateString(new Date()));
  const [total, setTotal] = useState(editing?.total ?? "");
  const [paidNow, setPaidNow] = useState("");
  const [fromDrawer, setFromDrawer] = useState(false);
  const [note, setNote] = useState(editing?.note ?? "");
  const [submitted, setSubmitted] = useState(false);
  const create = useCreateSupplierInvoiceMutation(supplierId);
  const update = useUpdateSupplierInvoiceMutation(supplierId);
  const mutation = editing ? update : create;

  const totalValue = Number(total);
  const paid = Number(paidNow || 0);
  const alreadyPaid = Number(editing?.paidAmount ?? 0);
  const totalInvalid = !(totalValue > 0) || totalValue < alreadyPaid;
  const paidInvalid = paid < 0 || paid > totalValue;
  const dateInvalid = !invoiceDate;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (totalInvalid || paidInvalid || dateInvalid) {
      return;
    }
    const common = {
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate,
      total,
      note: note.trim() || null,
    };
    try {
      if (editing) {
        await update.mutateAsync({ invoiceId: editing.id, input: common });
      } else {
        await create.mutateAsync({
          ...common,
          ...(canPay && paid > 0 && { paidNow, paidFromDrawer: fromDrawer }),
        });
      }
      toast.success(editing ? "suppliers.invoiceForm.saved" : "suppliers.invoiceForm.created");
      onClose();
    } catch {
      // Shown in the modal from mutation.error.
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      data-testid="supplier-invoice-modal"
      size="form"
      title={editing ? "suppliers.invoiceForm.editTitle" : "suppliers.invoiceForm.createTitle"}
      description="suppliers.invoiceForm.description"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {tCommon("cancel")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            data-test-selector="supplier-invoice-save"
            isLoading={mutation.isPending}
          >
            {t(editing ? "save" : "create")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        {mutation.isError && (
          <Alert tone="danger" data-testid="supplier-invoice-error">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
          </Alert>
        )}
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
          <FormField label="suppliers.invoiceForm.number" htmlFor="supplier-invoice-number" optional>
            <Input
              id="supplier-invoice-number"
              data-test-selector={fieldTestSelector("supplier-invoice-number")}
              dir="ltr"
              maxLength={SUPPLIER_INVOICE_NUMBER_MAX_LENGTH}
              placeholder={t("numberPlaceholder")}
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
            />
          </FormField>
          <FormField
            label="suppliers.invoiceForm.date"
            htmlFor="supplier-invoice-date"
            required
            error={submitted && dateInvalid ? INVALID : undefined}
            errorKey="suppliers.invoiceForm.dateRequired"
          >
            <DatePicker
              id="supplier-invoice-date"
              data-testid={fieldTestSelector("supplier-invoice-date")}
              label={t("date")}
              max={toLocalDateString(new Date())}
              value={invoiceDate}
              onChange={setInvoiceDate}
            />
          </FormField>
        </div>
        <FormField
          label="suppliers.invoiceForm.total"
          htmlFor="supplier-invoice-total"
          required
          error={submitted && totalInvalid ? INVALID : undefined}
          errorKey={alreadyPaid > 0 ? "suppliers.invoiceForm.totalBelowPaid" : "suppliers.invoiceForm.totalInvalid"}
        >
          <MoneyField
            id="supplier-invoice-total"
            data-test-selector={fieldTestSelector("supplier-invoice-total")}
            autoFocus
            placeholder="0"
            className="text-section font-bold"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
          />
        </FormField>

        {canPay && (
          <div
            className="flex flex-col gap-4 rounded-panel border border-line p-4"
            data-test-selector="supplier-invoice-paid"
          >
            <FormField
              label="suppliers.invoiceForm.paidNow"
              htmlFor="supplier-invoice-paid-now"
              optional
              note="suppliers.invoiceForm.paidNowHint"
              error={submitted && paidInvalid ? INVALID : undefined}
              errorKey="suppliers.invoiceForm.paidNowTooMuch"
            >
              <MoneyField
                id="supplier-invoice-paid-now"
                data-test-selector={fieldTestSelector("supplier-invoice-paid-now")}
                placeholder="0"
                value={paidNow}
                onChange={(event) => setPaidNow(event.target.value)}
              />
            </FormField>
            {paid > 0 && (
              <FormField
                label="suppliers.payment.fromDrawer"
                htmlFor="supplier-invoice-from-drawer"
                note="suppliers.payment.fromDrawerHint"
              >
                <Switch
                  id="supplier-invoice-from-drawer"
                  data-testid={fieldTestSelector("supplier-invoice-from-drawer")}
                  label={t("fromDrawerLabel")}
                  hideLabel
                  checked={fromDrawer}
                  onCheckedChange={setFromDrawer}
                />
              </FormField>
            )}
            {totalValue > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-panel bg-sunken px-4 py-3">
                <Typography variant="body" tone="muted" as="span">
                  {t("remaining")}
                </Typography>
                <Typography variant="h4" as="span" className="tabular-nums text-danger-700">
                  {formatMoney(String(Math.max(0, totalValue - paid)))}
                </Typography>
              </div>
            )}
          </div>
        )}

        <FormField label="suppliers.invoiceForm.note" htmlFor="supplier-invoice-note" optional>
          <Textarea
            id="supplier-invoice-note"
            data-test-selector={fieldTestSelector("supplier-invoice-note")}
            rows={2}
            maxLength={SUPPLIER_INVOICE_NOTE_MAX_LENGTH}
            placeholder={t("notePlaceholder")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
