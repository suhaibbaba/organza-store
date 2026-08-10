"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { VariantType } from "@organza/shared/types/variant";
import { localize } from "@/lib/i18n-content";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useAddOptionValueMutation, useCreateVariantTypeMutation } from "@/hooks/use-variant-types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
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
          <div key={type.id} className="rounded-xl border border-border bg-card p-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <Checkbox checked={isUsed} onCheckedChange={(checked) => toggleType(type.id, checked === true)} />
              <span className="text-sm font-medium text-foreground">{localize(type.name, locale)}</span>
            </label>

            {isUsed && (
              <div className="mt-3 flex flex-col gap-3 ps-9">
                <div className="flex flex-wrap gap-2">
                  {type.values.map((optionValue) => {
                    const checked = selectedValueIds.includes(optionValue.id);
                    return (
                      <button
                        key={optionValue.id}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleValue(type.id, optionValue.id, !checked)}
                        className={cn(
                          "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-foreground"
                        )}
                      >
                        {localize(optionValue.value, locale)}
                      </button>
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

      {variantTypes.length === 0 && <p className="text-sm text-muted-foreground">{t("noTypesYet")}</p>}
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
        className="inline-flex min-h-9 items-center gap-1 self-start text-sm font-medium text-primary"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t("addValue")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {/* No autoFocus: revealing the box is not the same as asking to
            type in it, and on a phone the keyboard covers the list of
            values being added to. */}
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("newValuePlaceholder")}
          className="h-10 flex-1"
        />
        <Button type="button" size="sm" onClick={() => void handleAdd()} disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner className="size-4" /> : t("add")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
        >
          {t("cancel")}
        </Button>
      </div>
      {mutation.isError && (
        <p className="text-xs text-destructive">
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
        className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-primary"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t("addType")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border p-3">
      <div className="flex items-center gap-2">
        {/* No autoFocus — same reason as the value box above. */}
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("newTypePlaceholder")}
          className="h-10 flex-1"
        />
        <Button type="button" size="sm" onClick={() => void handleAdd()} disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner className="size-4" /> : t("add")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
        >
          {t("cancel")}
        </Button>
      </div>
      {mutation.isError && (
        <p className="text-xs text-destructive">
          {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
        </p>
      )}
    </div>
  );
}
