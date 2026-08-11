"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@organza/shared/constants/languages";
import type { CategoryNode } from "@organza/shared/types/category";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";

interface CategoryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  category?: CategoryNode;
  tree: CategoryNode[];
}

// A category can't become its own parent, nor the parent of any of its
// current descendants (that would create a cycle the backend also rejects —
// see wouldCreateCycle in backend/src/routes/categories.ts) — excluded here
// so the picker never offers a choice that's guaranteed to fail.
function collectSubtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(collectSubtreeIds)];
}

export function CategoryFormSheet({ open, onOpenChange, mode, category, tree }: CategoryFormSheetProps) {
  const t = useTranslations("categories.form");
  const tCommon = useTranslations("common");
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

  // Sheets stay mounted while closed (for the exit animation), so the form
  // must be re-synced with the target category each time it opens rather
  // than only once on mount.
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" closeLabel={tCommon("close")}>
        <SheetHeader>
          <SheetTitle>{t(mode === "create" ? "createTitle" : "editTitle")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
          <div className="flex flex-col gap-2">
            <Label>{t("name")}</Label>
            <Tabs defaultValue={DEFAULT_LANGUAGE}>
              <TabsList>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <TabsTrigger key={lang} value={lang}>
                    {LOCALE_LABELS[lang]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TabsContent key={lang} value={lang}>
                  <Input
                    aria-label={`${t("name")} — ${LOCALE_LABELS[lang]}`}
                    placeholder={lang === DEFAULT_LANGUAGE ? t("required") : t("optional")}
                    aria-invalid={lang === DEFAULT_LANGUAGE && !!errors.name?.ar}
                    {...register(`name.${lang}` as "name.ar")}
                  />
                </TabsContent>
              ))}
            </Tabs>
            {errors.name?.ar && <p className="text-sm text-destructive">{translateError(errors.name.ar.message ?? "")}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="parentId">{t("parent")}</Label>
            <Controller
              control={control}
              name="parentId"
              render={({ field }) => (
                <Select id="parentId" value={field.value} onChange={field.onChange}>
                  <option value="">{t("noParent")}</option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {"  ".repeat(option.depth)}
                      {localize(option.name, locale)}
                    </option>
                  ))}
                </Select>
              )}
            />
          </div>

          {mutation.isError && (
            <Alert variant="destructive">
              {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
            </Alert>
          )}

          <Button type="submit" disabled={mutation.isPending} className="mt-auto w-full">
            {mutation.isPending ? (
              <>
                <Spinner />
                {t(mode === "create" ? "creating" : "saving")}
              </>
            ) : (
              t(mode === "create" ? "create" : "save")
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
