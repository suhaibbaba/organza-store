"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button, Checkbox, Chip, Input } from "@store/ui";
import type { VariantType } from "@organza/shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useAddOptionValueMutation, useCreateVariantTypeMutation } from "@/hooks/use-variant-types";
import { ApiError } from "@/lib/api/errors";
import type { VariantSelectionMap } from "@/types/productForm";

interface VariantTypePickerProps {
  variantTypes: VariantType[];
  value: VariantSelectionMap;
  onChange: (value: VariantSelectionMap) => void;
}

export function VariantTypePicker({ variantTypes, value, onChange }: VariantTypePickerProps) {
  const t = useTranslations("products.form.variants");
  const locale = useLocale();

  function toggleType(typeId: string, checked: boolean) {
    const next = { ...value };
    if (checked) next[typeId] = [];
    else delete next[typeId];
    onChange(next);
  }

  function toggleValue(typeId: string, valueId: string, checked: boolean) {
    const current = value[typeId] ?? [];
    const nextValues = checked ? [...current, valueId] : current.filter((id) => id !== valueId);
    onChange({ ...value, [typeId]: nextValues });
  }

  return (
    <div className="flex flex-col gap-3">
      {variantTypes.map((type) => {
        const isUsed = type.id in value;
        const selectedValueIds = value[type.id] ?? [];

        return (
          <div key={type.id} className="rounded-panel border border-line bg-surface p-3">
            <div className="flex min-h-11 items-center">
              <Checkbox
                checked={isUsed}
                onCheckedChange={(checked) => toggleType(type.id, checked)}
                label={localize(type.name, locale)}
              />
            </div>

            {isUsed && (
              <div className="mt-3 flex flex-col gap-3 ps-9">
                <div className="flex flex-wrap gap-2">
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
                </div>

                <AddValueInline
                  typeId={type.id}
                  onAdded={(valueId) => onChange({ ...value, [type.id]: [...selectedValueIds, valueId] })}
                />
              </div>
            )}
          </div>
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
      // error surfaced below via mutation.isError
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1 self-start text-label font-medium text-primary-600 hover:text-primary-700"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t("addValue")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Stacked on a phone: beside the buttons the field was narrower than its own placeholder. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* No autoFocus: on a phone the keyboard would cover the values being added to. */}
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
      // error surfaced below via mutation.isError
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1 self-start text-label font-medium text-primary-600 hover:text-primary-700"
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
