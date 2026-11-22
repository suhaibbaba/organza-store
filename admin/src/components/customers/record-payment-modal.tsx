"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Alert, Button, FormField, Modal, Textarea, Typography, useToast } from "@store/ui";
import { ORDER_PAYMENT_NOTE_MAX_LENGTH } from "@store/shared/constants/customer";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { MoneyField } from "@/components/fields/money-field";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

const FORM_ID = "record-payment-form";
const INVALID = { type: "invalid" } as const;

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  // What is still owed; the amount may never exceed it.
  balance: string;
  // Message keys, as Modal takes them.
  title: string;
  titleValues?: Record<string, string | number>;
  description: string;
  onSave: (input: { amount: string; note?: string }) => Promise<unknown>;
  // Shown under the amount (the customer page shows how it will be split).
  renderPreview?: (amount: string) => ReactNode;
}

// Any amount up to what is owed: no instalment plan, the shop takes whatever the customer brings.
export function RecordPaymentModal(props: RecordPaymentModalProps) {
  return props.open ? <RecordPaymentForm {...props} /> : null;
}

function RecordPaymentForm({
  open,
  onClose,
  balance,
  title,
  titleValues,
  description,
  onSave,
  renderPreview,
}: RecordPaymentModalProps) {
  const t = useTranslations("customers.payment");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const formatMoney = useMoneyFormatter();
  const translateError = useTranslateError();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const value = Number(amount);
  const invalid = !(value > 0) || value > Number(balance);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (invalid) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ amount, ...(note.trim() && { note: note.trim() }) });
      toast.success("customers.payment.saved");
      onClose();
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      data-testid="record-payment-modal"
      size="form"
      title={title}
      titleValues={titleValues}
      description={description}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} data-test-selector="record-payment-save" isLoading={saving}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        {error !== null && (
          <Alert tone="danger" data-testid="record-payment-error">
            {translateError(error instanceof ApiError ? error.code : "error.internal")}
          </Alert>
        )}

        <div className="flex items-center justify-between gap-3 rounded-panel bg-sunken px-4 py-3">
          <Typography variant="body" tone="muted" as="span">
            {t("owed")}
          </Typography>
          <Typography variant="h4" as="span" className="tabular-nums" data-test-selector="record-payment-owed">
            {formatMoney(balance)}
          </Typography>
        </div>

        <FormField
          label="customers.payment.amount"
          htmlFor="record-payment-amount"
          required
          error={submitted && invalid ? INVALID : undefined}
          errorKey="customers.payment.amountInvalid"
          note="customers.payment.amountHint"
        >
          <div className="flex items-stretch gap-2">
            <MoneyField
              id="record-payment-amount"
              data-test-selector={fieldTestSelector("payment-amount")}
              autoFocus
              placeholder={t("amountPlaceholder")}
              className="text-section font-bold"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              data-test-selector="record-payment-full"
              onClick={() => setAmount(balance)}
            >
              {t("payAll")}
            </Button>
          </div>
        </FormField>

        {renderPreview && value > 0 && !invalid && renderPreview(amount)}

        <FormField label="customers.payment.note" htmlFor="record-payment-note" optional>
          <Textarea
            id="record-payment-note"
            data-test-selector={fieldTestSelector("payment-note")}
            rows={2}
            maxLength={ORDER_PAYMENT_NOTE_MAX_LENGTH}
            placeholder={t("notePlaceholder")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
