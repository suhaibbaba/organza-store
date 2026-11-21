"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Alert,
  Button,
  CardButton,
  DatePicker,
  FormField,
  Modal,
  Switch,
  Textarea,
  Typography,
  useToast,
} from "@store/ui";
import { EXPENSE_NOTE_MAX_LENGTH } from "@store/shared/constants/expense";
import { fieldErrorTestSelector, fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import type { CreateExpenseInput, UpdateExpenseInput } from "@store/shared/schemas/expense";
import { MoneyField } from "@/components/fields/money-field";
import { useCreateExpenseMutation, useExpenseCategoriesQuery, useUpdateExpenseMutation } from "@/hooks/use-expenses";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { localize } from "@/lib/i18n-content";
import { toLocalDateString } from "@/lib/report-range";
import { cn } from "@/lib/utils";
import type { Expense, ExpenseFormModalProps, ExpenseFormValues } from "@/types/expense";

const FORM_ID = "expense-form";
const REQUIRED = { type: "required" } as const;

function emptyValues(): ExpenseFormValues {
  return {
    amount: "",
    categoryId: "",
    date: toLocalDateString(new Date()),
    paidInCash: true,
    isRecurring: false,
    note: "",
  };
}

function valuesOf(expense: Expense): ExpenseFormValues {
  return {
    amount: expense.amount,
    categoryId: expense.categoryId,
    date: toLocalDateString(new Date(expense.date)),
    paidInCash: expense.paidInCash,
    isRecurring: expense.isRecurring,
    note: expense.note ?? "",
  };
}

// A day picked as a date is sent as its local noon, so no time zone can move it to the day before.
function dateToSend(date: string): string {
  return new Date(`${date}T12:00:00`).toISOString();
}

// Amount first and big, then one tap for the category: an expense is written down standing at the till.
export function ExpenseFormModal({ target, onClose }: ExpenseFormModalProps) {
  const t = useTranslations("expenses.form");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();
  const translateError = useTranslateError();
  const { data: categories = [] } = useExpenseCategoriesQuery();

  const [shown, setShown] = useState(target);
  const [values, setValues] = useState<ExpenseFormValues>(() =>
    target?.mode === "edit" ? valuesOf(target.expense) : emptyValues(),
  );
  const [submitted, setSubmitted] = useState(false);
  // Each open starts from its target; the last one stays shown while the modal fades out.
  if (target && target !== shown) {
    setShown(target);
    setSubmitted(false);
    setValues(target.mode === "edit" ? valuesOf(target.expense) : emptyValues());
  }
  const editing = shown?.mode === "edit" ? shown.expense : undefined;

  const createMutation = useCreateExpenseMutation();
  const updateMutation = useUpdateExpenseMutation();
  const mutation = editing ? updateMutation : createMutation;
  const { reset: resetCreate } = createMutation;
  const { reset: resetUpdate } = updateMutation;

  useEffect(() => {
    if (!target) {
      return;
    }
    resetCreate();
    resetUpdate();
  }, [target, resetCreate, resetUpdate]);

  // A retired category stays offered on the expense already filed under it.
  const choices = categories.filter((category) => category.isActive || category.id === editing?.categoryId);
  const amountError = !(Number(values.amount) > 0);
  const categoryError = !values.categoryId;

  function change(patch: Partial<ExpenseFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (amountError || categoryError || !values.date) {
      return;
    }
    const note = values.note.trim();
    try {
      if (editing) {
        const input: UpdateExpenseInput = {
          amount: values.amount,
          categoryId: values.categoryId,
          paidInCash: values.paidInCash,
          isRecurring: values.isRecurring,
          note: note || null,
          ...(values.date !== valuesOf(editing).date && { date: new Date(dateToSend(values.date)) }),
        };
        await updateMutation.mutateAsync({ id: editing.id, input });
        toast.success("expenses.form.saved");
      } else {
        const today = toLocalDateString(new Date());
        const input: CreateExpenseInput = {
          amount: values.amount,
          categoryId: values.categoryId,
          paidInCash: values.paidInCash,
          isRecurring: values.isRecurring,
          ...(note && { note }),
          // Today keeps the real time it was written; another day is backdated.
          ...(values.date !== today && { date: new Date(dateToSend(values.date)) }),
        };
        const created = await createMutation.mutateAsync(input);
        toast.success(created.approvalStatus === "PENDING" ? "expenses.form.sentForApproval" : "expenses.form.created");
      }
      onClose();
    } catch {
      // Shown in the modal from mutation.error.
    }
  }

  return (
    <Modal
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      data-testid="expense-form-modal"
      size="form"
      title={editing ? "expenses.form.editTitle" : "expenses.form.createTitle"}
      description={editing ? "expenses.form.editDescription" : "expenses.form.createDescription"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} data-test-selector="expense-save" isLoading={mutation.isPending}>
            {t(editing ? "save" : "create")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
        {mutation.isError && (
          <Alert tone="danger" data-testid="expense-form-error">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="expenses.form.amount"
            htmlFor="expense-amount"
            required
            error={submitted && amountError ? REQUIRED : undefined}
            errorKey="expenses.form.amountRequired"
          >
            <MoneyField
              id="expense-amount"
              data-test-selector={fieldTestSelector("amount")}
              autoFocus
              placeholder={t("amountPlaceholder")}
              className="text-section font-bold"
              value={values.amount}
              onChange={(event) => change({ amount: event.target.value })}
            />
          </FormField>
          <FormField label="expenses.form.date" htmlFor="expense-date" required>
            <DatePicker
              id="expense-date"
              data-testid={fieldTestSelector("date")}
              label={t("date")}
              max={toLocalDateString(new Date())}
              value={values.date}
              onChange={(date) => change({ date })}
            />
          </FormField>
        </div>

        <fieldset className="flex flex-col gap-2" data-test-selector={fieldTestSelector("categoryId")}>
          <Typography as="legend" variant="label" className="mb-2">
            {t("category")}
          </Typography>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {choices.map((category) => (
              <CardButton
                key={category.id}
                selected={values.categoryId === category.id}
                data-testid={testSelectorFor("expense-category-choice", category.id)}
                onClick={() => change({ categoryId: category.id })}
                className="min-h-12 items-center justify-center px-3 py-2 text-center"
              >
                <Typography
                  variant="body"
                  as="span"
                  weight={values.categoryId === category.id ? "semibold" : undefined}
                  className={cn("w-full", values.categoryId === category.id && "text-primary-900")}
                >
                  {localize(category.name, locale)}
                </Typography>
              </CardButton>
            ))}
          </div>
          {submitted && categoryError && (
            <Typography
              variant="small"
              tone="error"
              role="alert"
              data-test-selector={fieldErrorTestSelector("categoryId")}
            >
              {t("categoryRequired")}
            </Typography>
          )}
        </fieldset>

        <div className="flex flex-col divide-y divide-line rounded-panel border border-line">
          <div className="flex items-center justify-between gap-4 p-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Typography variant="body" as="span">
                {t("paidInCash")}
              </Typography>
              <Typography variant="caption" tone="muted" as="span">
                {t("paidInCashHint")}
              </Typography>
            </div>
            <Switch
              data-testid={fieldTestSelector("paidInCash")}
              label={t("paidInCash")}
              hideLabel
              checked={values.paidInCash}
              onCheckedChange={(paidInCash) => change({ paidInCash })}
            />
          </div>
          <div className="flex items-center justify-between gap-4 p-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Typography variant="body" as="span">
                {t("isRecurring")}
              </Typography>
              <Typography variant="caption" tone="muted" as="span">
                {t("isRecurringHint")}
              </Typography>
            </div>
            <Switch
              data-testid={fieldTestSelector("isRecurring")}
              label={t("isRecurring")}
              hideLabel
              checked={values.isRecurring}
              onCheckedChange={(isRecurring) => change({ isRecurring })}
            />
          </div>
        </div>

        <FormField label="expenses.form.note" htmlFor="expense-note" optional>
          <Textarea
            id="expense-note"
            data-testid={fieldTestSelector("note")}
            rows={2}
            maxLength={EXPENSE_NOTE_MAX_LENGTH}
            placeholder={t("notePlaceholder")}
            value={values.note}
            onChange={(event) => change({ note: event.target.value })}
          />
        </FormField>
      </form>
    </Modal>
  );
}
