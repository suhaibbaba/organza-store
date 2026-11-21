"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Alert, Button, Drawer, FormField, Input, SegmentedControl, Select } from "@store/ui";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@store/shared/constants/languages";
import type { CategoryNode } from "@store/shared/types/category";
import type { SupportedLanguage } from "@store/shared/types/language";
import { fieldErrorTestSelector, fieldTestSelector } from "@store/shared/lib/testSelector";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useCreateCategoryMutation, useUpdateCategoryMutation } from "@/hooks/use-categories";
import { flattenCategoryTree } from "@/lib/api/categories";
import { localize } from "@/lib/i18n-content";
import { LOCALE_LABELS } from "@/constants/locale";
import {
  categoryFormSchema,
  DEFAULT_CATEGORY_FORM_VALUES,
  categoryToFormValues,
  toCreatePayload,
  toUpdatePayload,
  type CategoryFormValues,
} from "@/lib/validation/category-form";
import { ApiError } from "@/lib/api/errors";

const FORM_ID = "category-form";

interface CategoryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  category?: CategoryNode;
  tree: CategoryNode[];
}

// A category's own subtree is never offered as its parent: the backend rejects the cycle (wouldCreateCycle).
function collectSubtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(collectSubtreeIds)];
}

export function CategoryFormSheet({ open, onOpenChange, mode, category, tree }: CategoryFormSheetProps) {
  const t = useTranslations("categories.form");
  const [nameLanguage, setNameLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const locale = useLocale();
  const translateError = useTranslateError();

  const excludedIds = useMemo(
    () => (category ? new Set(collectSubtreeIds(category)) : new Set<string>()),
    [category]
  );
  const parentOptions = useMemo(
    () => flattenCategoryTree(tree).filter((option) => !excludedIds.has(option.id)),
    [tree, excludedIds]
  );

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

  // The drawer stays mounted while closed, so the form re-syncs with its target on every open.
  useEffect(() => {
    if (open) reset(mode === "edit" && category ? categoryToFormValues(category) : DEFAULT_CATEGORY_FORM_VALUES);
  }, [open, mode, category, reset]);

  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation(category?.id ?? "");
  const mutation = mode === "create" ? createMutation : updateMutation;

  async function onSubmit(values: CategoryFormValues) {
    try {
      if (mode === "create") {
        await createMutation.mutateAsync(toCreatePayload(values));
      } else if (category) {
        await updateMutation.mutateAsync(toUpdatePayload(values));
      }
      onOpenChange(false);
    } catch {
      // surfaced below via mutation.isError
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      data-testid="sheet-category-form"
      title={t(mode === "create" ? "createTitle" : "editTitle")}
      descriptionKey="categories.subtitle"
      footer={
        <Button type="submit" form={FORM_ID} data-test-selector="category-save" isLoading={mutation.isPending}>
          {mutation.isPending
            ? t(mode === "create" ? "creating" : "saving")
            : t(mode === "create" ? "create" : "save")}
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormField label="categories.form.name" htmlFor={`name-${nameLanguage}`}>
          <SegmentedControl
            data-testid="tab"
            label={t("name")}
            options={SUPPORTED_LANGUAGES.map((lang) => ({ value: lang, label: LOCALE_LABELS[lang] }))}
            value={nameLanguage}
            onChange={setNameLanguage}
          />
          <div data-test-selector={`tab-panel-${nameLanguage}`}>
            <Input
              key={nameLanguage}
              id={`name-${nameLanguage}`}
              aria-label={`${t("name")} — ${LOCALE_LABELS[nameLanguage]}`}
              placeholder={nameLanguage === DEFAULT_LANGUAGE ? t("required") : t("optional")}
              hasError={nameLanguage === DEFAULT_LANGUAGE && !!errors.name?.ar}
              {...register(`name.${nameLanguage}` as "name.ar")}
            />
          </div>
          {errors.name?.ar && (
            <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector("name")}>
              {translateError(errors.name.ar.message ?? "")}
            </p>
          )}
        </FormField>

        <FormField label="categories.form.parent" htmlFor="parentId">
          <Controller
            control={control}
            name="parentId"
            render={({ field }) => (
              <Select
                id="parentId"
                data-testid={fieldTestSelector("parentId")}
                placeholder={t("noParent")}
                options={parentOptions.map((option) => ({
                  value: option.id,
                  label: `${"\u00a0\u00a0".repeat(option.depth)}${localize(option.name, locale)}`,
                }))}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
        </FormField>

        {mutation.isError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
          </Alert>
        )}
      </form>
    </Drawer>
  );
}
