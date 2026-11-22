"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Input,
  Modal,
  PhoneCountryProvider,
  PhoneInput,
  Textarea,
  useToast,
} from "@store/ui";
import { splitPhone } from "@store/ui/lib/support/phone";
import {
  CUSTOMER_ADDRESS_MAX_LENGTH,
  CUSTOMER_NAME_MAX_LENGTH,
  CUSTOMER_NOTE_MAX_LENGTH,
} from "@store/shared/constants/customer";
import { createCustomerSchema } from "@store/shared/schemas/customer";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { useCreateCustomerMutation, useUpdateCustomerMutation } from "@/hooks/use-customers";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import type { Customer, CustomerFormTarget } from "@/types/customer";

const FORM_ID = "customer-form";

interface CustomerFormValues {
  name: string;
  phone: string;
  hasWhatsapp: boolean;
  whatsapp: string;
  address: string;
  note: string;
}

function valuesOf(customer?: Customer): CustomerFormValues {
  return {
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    hasWhatsapp: Boolean(customer?.whatsapp),
    whatsapp: customer?.whatsapp ?? "",
    address: customer?.address ?? "",
    note: customer?.note ?? "",
  };
}

interface CustomerFormModalProps {
  target: CustomerFormTarget | null;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
}

export function CustomerFormModal(props: CustomerFormModalProps) {
  return props.target ? <CustomerForm {...props} target={props.target} /> : null;
}

function CustomerForm({ target, onClose, onSaved }: CustomerFormModalProps & { target: CustomerFormTarget }) {
  const t = useTranslations("customers.form");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const translateError = useTranslateError();
  const { data: settings } = useSettingsQuery();
  const defaultCountry = splitPhone(settings?.defaultCountryCode).country;
  const editing = target.mode === "edit" ? target.customer : undefined;
  const [values, setValues] = useState(() => valuesOf(editing));
  const [submitted, setSubmitted] = useState(false);
  const createMutation = useCreateCustomerMutation();
  const updateMutation = useUpdateCustomerMutation();
  const mutation = editing ? updateMutation : createMutation;

  const input = {
    name: values.name.trim(),
    phone: values.phone,
    ...(values.hasWhatsapp && values.whatsapp && { whatsapp: values.whatsapp }),
    ...(values.address.trim() && { address: values.address.trim() }),
    ...(values.note.trim() && { note: values.note.trim() }),
  };
  const parsed = createCustomerSchema.safeParse(input);
  const issues = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue]));
  const errorFor = (field: string) =>
    submitted && issues[field] ? { type: "invalid", message: String(issues[field].message) } : undefined;

  function change(patch: Partial<CustomerFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!parsed.success) {
      return;
    }
    try {
      const saved = editing
        ? await updateMutation.mutateAsync({
            id: editing.id,
            input: {
              ...parsed.data,
              whatsapp: parsed.data.whatsapp ?? null,
              address: parsed.data.address ?? null,
              note: parsed.data.note ?? null,
            },
          })
        : await createMutation.mutateAsync(parsed.data);
      toast.success(editing ? "customers.form.saved" : "customers.form.created");
      onSaved?.(saved);
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
      data-testid="customer-form-modal"
      size="form"
      title={editing ? "customers.form.editTitle" : "customers.form.createTitle"}
      description="customers.form.description"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} data-test-selector="customer-save" isLoading={mutation.isPending}>
            {t(editing ? "save" : "create")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        {mutation.isError && (
          <Alert tone="danger" data-testid="customer-form-error">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
          </Alert>
        )}
        <PhoneCountryProvider country={defaultCountry}>
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <FormField
              label="customers.form.name"
              htmlFor="customer-form-name"
              required
              error={errorFor("name")}
              errorKey="customers.form.nameRequired"
            >
              <Input
                id="customer-form-name"
                data-test-selector={fieldTestSelector("customer-form-name")}
                autoFocus
                maxLength={CUSTOMER_NAME_MAX_LENGTH}
                placeholder={t("namePlaceholder")}
                hasError={!!errorFor("name")}
                value={values.name}
                onChange={(event) => change({ name: event.target.value })}
              />
            </FormField>
            <FormField
              label="customers.form.phone"
              htmlFor="customer-form-phone"
              required
              error={errorFor("phone")}
              errorKey="customers.form.phoneInvalid"
            >
              <PhoneInput
                id="customer-form-phone"
                data-test-selector={fieldTestSelector("customer-form-phone")}
                placeholder={t("phonePlaceholder")}
                value={values.phone}
                onChange={(phone) => change({ phone: phone ?? "" })}
                hasError={!!errorFor("phone")}
              />
            </FormField>
          </div>
          <Checkbox
            id="customer-form-has-whatsapp"
            data-testid={fieldTestSelector("customer-form-has-whatsapp")}
            label={t("whatsappToggle")}
            checked={values.hasWhatsapp}
            onCheckedChange={(hasWhatsapp) => change({ hasWhatsapp })}
          />
          {values.hasWhatsapp && (
            <FormField
              label="customers.form.whatsapp"
              htmlFor="customer-form-whatsapp"
              optional
              error={errorFor("whatsapp")}
              errorKey="customers.form.phoneInvalid"
            >
              <PhoneInput
                id="customer-form-whatsapp"
                data-test-selector={fieldTestSelector("customer-form-whatsapp")}
                placeholder={t("phonePlaceholder")}
                value={values.whatsapp}
                onChange={(whatsapp) => change({ whatsapp: whatsapp ?? "" })}
                hasError={!!errorFor("whatsapp")}
              />
            </FormField>
          )}
        </PhoneCountryProvider>
        <FormField label="customers.form.address" htmlFor="customer-form-address" optional>
          <Textarea
            id="customer-form-address"
            data-test-selector={fieldTestSelector("customer-form-address")}
            rows={2}
            maxLength={CUSTOMER_ADDRESS_MAX_LENGTH}
            placeholder={t("addressPlaceholder")}
            value={values.address}
            onChange={(event) => change({ address: event.target.value })}
          />
        </FormField>
        <FormField label="customers.form.note" htmlFor="customer-form-note" optional>
          <Textarea
            id="customer-form-note"
            data-test-selector={fieldTestSelector("customer-form-note")}
            rows={2}
            maxLength={CUSTOMER_NOTE_MAX_LENGTH}
            placeholder={t("notePlaceholder")}
            value={values.note}
            onChange={(event) => change({ note: event.target.value })}
          />
        </FormField>
      </form>
    </Modal>
  );
}
