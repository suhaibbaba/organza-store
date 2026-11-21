"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button, FormField, Modal, Select, TranslatedField, Typography, useToast } from "@store/ui";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@store/shared/constants/languages";
import { fieldErrorTestSelector, fieldTestSelector } from "@store/shared/lib/testSelector";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useCreateCategoryMutation, useUpdateCategoryMutation } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { categorySubtreeIds } from "@/lib/categories";
import { localize } from "@/lib/i18n-content";
import { LOCALE_LABELS } from "@/constants/locale";
import type { AppLocale } from "@/i18n/routing";
import {
  categoryFormSchema,
  categoryToFormValues,
  DEFAULT_CATEGORY_FORM_VALUES,
  toCreatePayload,
  toUpdatePayload,
  type CategoryFormValues,
} from "@/lib/validation/category-form";
import { ApiError } from "@/lib/api/errors";
import type { CategoryFormModalProps } from "@/types/category";

const FORM_ID = "category-form";
const NAME_LANGUAGES = [DEFAULT_LANGUAGE, ...SUPPORTED_LANGUAGES.filter((lang) => lang !== DEFAULT_LANGUAGE)];

export function CategoryFormModal({ target, tree, onClose }: CategoryFormModalProps) {
  const t = useTranslations("categories.form");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();
  const translateError = useTranslateError();
  const [shown, setShown] = useState(target);
  // The last target stays shown while the modal fades out, so its title never flips mid-close.
  if (target && target !== shown) {
    setShown(target);
  }
  const editing = shown?.mode === "edit" ? shown.category : undefined;

  const parentOptions = useMemo(() => {
    const excluded = new Set(editing ? categorySubtreeIds(editing) : []);
    return flattenCategoryTree(tree)
      .filter((option) => !excluded.has(option.id))
      .map((option) => ({
        value: option.id,
        label: `${"  ".repeat(option.depth)}${localize(option.name, locale)}`,
      }));
  }, [tree, editing, locale]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: DEFAULT_CATEGORY_FORM_VALUES,
  });
  const name = useWatch({ control, name: "name" });

  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation(editing?.id ?? "");
  const mutation = editing ? updateMutation : createMutation;
  const { reset: resetCreate } = createMutation;
  const { reset: resetUpdate } = updateMutation;

  // Each open starts from its target: the category being edited, or an empty one under the chosen parent.
  useEffect(() => {
    if (!target) {
      return;
    }
    resetCreate();
    resetUpdate();
    reset(
      target.mode === "edit"
        ? categoryToFormValues(target.category)
        : { ...DEFAULT_CATEGORY_FORM_VALUES, parentId: target.parentId ?? "" },
    );
  }, [target, reset, resetCreate, resetUpdate]);

  async function onSubmit(values: CategoryFormValues) {
    try {
      if (editing) {
        await updateMutation.mutateAsync(toUpdatePayload(values));
        toast.success("categories.form.saved");
      } else {
        await createMutation.mutateAsync(toCreatePayload(values));
        toast.success("categories.form.created");
      }
      onClose();
    } catch {
      // The error is shown in the modal from mutation.error.
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
      data-testid="category-form-modal"
      title={editing ? "categories.form.editTitle" : "categories.form.createTitle"}
      description={editing ? "categories.form.editDescription" : "categories.form.createDescription"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} data-test-selector="category-save" isLoading={mutation.isPending}>
            {t(editing ? "save" : "create")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {mutation.isError && (
          <Alert tone="danger" data-testid="category-form-error">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
          </Alert>
        )}

        <fieldset className="flex flex-col gap-1.5">
          <Typography as="legend" variant="label" className="mb-1.5">
            {t("name")}
          </Typography>
          <TranslatedField
            data-testid="translated-category-name"
            languages={NAME_LANGUAGES.map((code) => ({ code, name: LOCALE_LABELS[code as AppLocale] ?? code }))}
            values={name}
            hasError={!!errors.name?.ar}
            controlProps={(lang) => ({
              "data-test-selector": fieldTestSelector(`name-${lang}`),
              "aria-label": `${t("name")} — ${LOCALE_LABELS[lang as AppLocale] ?? lang}`,
              placeholder: lang === DEFAULT_LANGUAGE ? t("required") : t("optional"),
              ...register(`name.${lang}` as "name.ar"),
            })}
          />
          {errors.name?.ar && (
            <Typography variant="small" tone="error" role="alert" data-test-selector={fieldErrorTestSelector("name")}>
              {translateError(errors.name.ar.message ?? "")}
            </Typography>
          )}
        </fieldset>

        <FormField label="categories.form.parent" hint="categories.form.parentHint" htmlFor="parentId">
          <Controller
            control={control}
            name="parentId"
            render={({ field }) => (
              <Select
                id="parentId"
                data-testid={fieldTestSelector("parentId")}
                placeholder={t("noParent")}
                options={parentOptions}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </FormField>
      </form>
    </Modal>
  );
}
