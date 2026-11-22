"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Alert,
  Button,
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
  SUPPLIER_ADDRESS_MAX_LENGTH,
  SUPPLIER_NAME_MAX_LENGTH,
  SUPPLIER_NOTE_MAX_LENGTH,
} from "@store/shared/constants/supplier";
import { createSupplierSchema } from "@store/shared/schemas/supplier";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { useCreateSupplierMutation, useUpdateSupplierMutation } from "@/hooks/use-suppliers";
import { useSettingsQuery } from "@/hooks/use-settings";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import type { Supplier, SupplierFormTarget } from "@/types/supplier";

const FORM_ID = "supplier-form";

interface SupplierFormValues {
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  note: string;
}

function valuesOf(supplier?: Supplier): SupplierFormValues {
  return {
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    whatsapp: supplier?.whatsapp ?? "",
    address: supplier?.address ?? "",
    note: supplier?.note ?? "",
  };
}

interface SupplierFormModalProps {
  target: SupplierFormTarget | null;
  onClose: () => void;
  onSaved?: (supplier: Supplier) => void;
}

export function SupplierFormModal(props: SupplierFormModalProps) {
  return props.target ? <SupplierForm {...props} target={props.target} /> : null;
}

function SupplierForm({ target, onClose, onSaved }: SupplierFormModalProps & { target: SupplierFormTarget }) {
  const t = useTranslations("suppliers.form");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const translateError = useTranslateError();
  const { data: settings } = useSettingsQuery();
  const defaultCountry = splitPhone(settings?.defaultCountryCode).country;
  const editing = target.mode === "edit" ? target.supplier : undefined;
  const [values, setValues] = useState(() => valuesOf(editing));
  const [submitted, setSubmitted] = useState(false);
  const createMutation = useCreateSupplierMutation();
  const updateMutation = useUpdateSupplierMutation();
  const mutation = editing ? updateMutation : createMutation;

  const input = {
    name: values.name.trim(),
    ...(values.phone && { phone: values.phone }),
    ...(values.whatsapp && { whatsapp: values.whatsapp }),
    ...(values.address.trim() && { address: values.address.trim() }),
    ...(values.note.trim() && { note: values.note.trim() }),
  };
  const parsed = createSupplierSchema.safeParse(input);
  const issues = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue]));
  const errorFor = (field: string) =>
    submitted && issues[field] ? { type: "invalid", message: String(issues[field].message) } : undefined;

  function change(patch: Partial<SupplierFormValues>) {
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
              phone: parsed.data.phone ?? null,
              whatsapp: parsed.data.whatsapp ?? null,
              address: parsed.data.address ?? null,
              note: parsed.data.note ?? null,
            },
          })
        : await createMutation.mutateAsync(parsed.data);
      toast.success(editing ? "suppliers.form.saved" : "suppliers.form.created");
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
      data-testid="supplier-form-modal"
      size="form"
      title={editing ? "suppliers.form.editTitle" : "suppliers.form.createTitle"}
      description="suppliers.form.description"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} data-test-selector="supplier-save" isLoading={mutation.isPending}>
            {t(editing ? "save" : "create")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        {mutation.isError && (
          <Alert tone="danger" data-testid="supplier-form-error">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
          </Alert>
        )}
        <FormField
          label="suppliers.form.name"
          htmlFor="supplier-form-name"
          required
          error={errorFor("name")}
          errorKey="suppliers.form.nameRequired"
        >
          <Input
            id="supplier-form-name"
            data-test-selector={fieldTestSelector("supplier-form-name")}
            autoFocus
            maxLength={SUPPLIER_NAME_MAX_LENGTH}
            placeholder={t("namePlaceholder")}
            hasError={!!errorFor("name")}
            value={values.name}
            onChange={(event) => change({ name: event.target.value })}
          />
        </FormField>
        <PhoneCountryProvider country={defaultCountry}>
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <FormField
              label="suppliers.form.phone"
              htmlFor="supplier-form-phone"
              optional
              error={errorFor("phone")}
              errorKey="suppliers.form.phoneInvalid"
            >
              <PhoneInput
                id="supplier-form-phone"
                data-test-selector={fieldTestSelector("supplier-form-phone")}
                placeholder={t("phonePlaceholder")}
                value={values.phone}
                onChange={(phone) => change({ phone: phone ?? "" })}
                hasError={!!errorFor("phone")}
              />
            </FormField>
            <FormField
              label="suppliers.form.whatsapp"
              htmlFor="supplier-form-whatsapp"
              optional
              error={errorFor("whatsapp")}
              errorKey="suppliers.form.phoneInvalid"
            >
              <PhoneInput
                id="supplier-form-whatsapp"
                data-test-selector={fieldTestSelector("supplier-form-whatsapp")}
                placeholder={t("phonePlaceholder")}
                value={values.whatsapp}
                onChange={(whatsapp) => change({ whatsapp: whatsapp ?? "" })}
                hasError={!!errorFor("whatsapp")}
              />
            </FormField>
          </div>
        </PhoneCountryProvider>
        <FormField label="suppliers.form.address" htmlFor="supplier-form-address" optional>
          <Textarea
            id="supplier-form-address"
            data-test-selector={fieldTestSelector("supplier-form-address")}
            rows={2}
            maxLength={SUPPLIER_ADDRESS_MAX_LENGTH}
            placeholder={t("addressPlaceholder")}
            value={values.address}
            onChange={(event) => change({ address: event.target.value })}
          />
        </FormField>
        <FormField label="suppliers.form.note" htmlFor="supplier-form-note" optional>
          <Textarea
            id="supplier-form-note"
            data-test-selector={fieldTestSelector("supplier-form-note")}
            rows={2}
            maxLength={SUPPLIER_NOTE_MAX_LENGTH}
            placeholder={t("notePlaceholder")}
            value={values.note}
            onChange={(event) => change({ note: event.target.value })}
          />
        </FormField>
      </form>
    </Modal>
  );
}
