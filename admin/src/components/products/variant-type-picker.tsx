"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button, Chip, Input, Section, Switch } from "@store/ui";
import type { VariantType } from "@organza/shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useAddOptionValueMutation, useCreateVariantTypeMutation } from "@/hooks/use-variant-types";
import { ApiError } from "@/lib/api/errors";
import type { VariantSelectionMap } from "@/types/productForm";
import { VARIANT_PICKER_SUMMARY_NAMES as SUMMARY_NAMES } from "@/constants/products";

interface VariantTypePickerProps {
  variantTypes: VariantType[];
  value: VariantSelectionMap;
  onChange: (value: VariantSelectionMap) => void;
}

export function VariantTypePicker({ variantTypes, value, onChange }: VariantTypePickerProps) {
  const t = useTranslations("products.form.variants");
  const locale = useLocale();

  function toggleValue(typeId: string, valueId: string, checked: boolean) {
    const current = value[typeId] ?? [];
    const nextValues = checked ? [...current, valueId] : current.filter((id) => id !== valueId);
    const next = { ...value, [typeId]: nextValues };
    if (nextValues.length === 0) delete next[typeId];
    onChange(next);
  }

  function setAll(typeId: string, valueIds: string[]) {
    const next = { ...value, [typeId]: valueIds };
    if (valueIds.length === 0) delete next[typeId];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {variantTypes.map((type, index) => {
        const selectedValueIds = value[type.id] ?? [];
        const selectedNames = type.values
          .filter((optionValue) => selectedValueIds.includes(optionValue.id))
          .map((optionValue) => localize(optionValue.value, locale));
        return (
          <Section
            key={type.id}
            data-testid={`variant-type-${type.id}`}
            title={localize(type.name, locale)}
            description={
              selectedNames.length > 0
                ? [
                    t("selectedCount", { count: selectedNames.length }),
                    selectedNames.slice(0, SUMMARY_NAMES).join("، ") +
                      (selectedNames.length > SUMMARY_NAMES ? ` +${selectedNames.length - SUMMARY_NAMES}` : ""),
                  ].join(" · ")
                : t("noneSelected")
            }
            collapsible
            defaultOpen={index === 0 || selectedValueIds.length > 0}
            className="shadow-none"
          >
            {type.values.length > 0 && (
              <Switch
                size="sm"
                data-testid={`variant-type-select-all-${type.id}`}
                label={t("selectAll")}
                checked={selectedValueIds.length === type.values.length}
                onCheckedChange={(checked) => setAll(type.id, checked ? type.values.map((v) => v.id) : [])}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              {type.values.map((optionValue) => {
                const checked = selectedValueIds.includes(optionValue.id);
                return (
                  <Chip
                    key={optionValue.id}
                    selected={checked}
                    onClick={() => toggleValue(type.id, optionValue.id, !checked)}
                  >
                    {localize(optionValue.value, locale)}
                  </Chip>
                );
              })}
              <AddValueInline
                typeId={type.id}
                onAdded={(valueId) => onChange({ ...value, [type.id]: [...selectedValueIds, valueId] })}
              />
            </div>
          </Section>
        );
      })}

      <AddTypeInline onCreated={(typeId) => onChange({ ...value, [typeId]: [] })} />

      {variantTypes.length === 0 && <p className="text-label text-ink-muted">{t("noTypesYet")}</p>}
    </div>
  );
}

function AddValueInline({ typeId, onAdded }: { typeId: string; onAdded: (valueId: string) => void }) {
  const t = useTranslations("products.form.variants");
  const translateError = useTranslateError();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const mutation = useAddOptionValueMutation();

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const created = await mutation.mutateAsync({ variantTypeId: typeId, value: { ar: trimmed } });
      onAdded(created.id);
      setText("");
      setOpen(false);
    } catch {
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-pill border border-dashed border-line-strong px-3 text-label text-primary-600 hover:border-primary-600 focus-visible:border-primary-700 focus-visible:bg-primary-100 focus-visible:text-primary-800"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t("addValue")}
      </button>
    );
  }

  return (
    <div className="flex basis-full flex-col gap-1.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("newValuePlaceholder")}
          className="w-full min-w-0 sm:flex-1"
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleAdd()}
            isLoading={mutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {t("add")}
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setOpen(false);
              setText("");
            }}
            className="flex-1 sm:flex-none"
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
      {mutation.isError && (
        <p className="text-micro text-danger-600" role="alert">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
        </p>
      )}
    </div>
  );
}

function AddTypeInline({ onCreated }: { onCreated: (typeId: string) => void }) {
  const t = useTranslations("products.form.variants");
  const translateError = useTranslateError();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const mutation = useCreateVariantTypeMutation();

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const created = await mutation.mutateAsync({ name: { ar: trimmed } });
      onCreated(created.id);
      setText("");
      setOpen(false);
    } catch {
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1 self-start text-label font-medium text-primary-600 hover:text-primary-700 focus-link"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t("addType")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-panel border border-dashed border-line-strong p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("newTypePlaceholder")}
          className="w-full min-w-0 sm:flex-1"
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleAdd()}
            isLoading={mutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {t("add")}
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setOpen(false);
              setText("");
            }}
            className="flex-1 sm:flex-none"
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
      {mutation.isError && (
        <p className="text-micro text-danger-600" role="alert">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
        </p>
      )}
    </div>
  );
}
