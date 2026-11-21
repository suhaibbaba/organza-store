"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  Drawer,
  IconButton,
  Modal,
  Skeleton,
  Switch,
  TranslatedField,
  Typography,
  useConfirm,
  useToast,
} from "@store/ui";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@store/shared/constants/languages";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import type { I18n } from "@store/shared/types/common";
import {
  useCreateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation,
  useExpenseCategoriesQuery,
  useUpdateExpenseCategoryMutation,
} from "@/hooks/use-expenses";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { errorMessageKey } from "@/lib/error-message-key";
import { localize } from "@/lib/i18n-content";
import { LOCALE_LABELS } from "@/constants/locale";
import { EXPENSE_CATEGORY_KEY_PREFIX } from "@/constants/expenses";
import type { AppLocale } from "@/i18n/routing";
import type { ExpenseCategory, ExpenseCategoriesDrawerProps, ExpenseCategoryFormTarget } from "@/types/expense";

const FORM_ID = "expense-category-form";
const NAME_LANGUAGES = [DEFAULT_LANGUAGE, ...SUPPORTED_LANGUAGES.filter((lang) => lang !== DEFAULT_LANGUAGE)];
const EMPTY_NAME: I18n = { ar: "", en: "", he: "" };

// The key is never shown, so it is minted rather than asked for; renaming later changes only the name.
function newCategoryKey(): string {
  return `${EXPENSE_CATEGORY_KEY_PREFIX}${Date.now().toString(36)}`;
}

// The shop's own list: add, rename, switch off; delete only while nothing is filed under it.
export function ExpenseCategoriesDrawer({ open, onOpenChange }: ExpenseCategoriesDrawerProps) {
  const t = useTranslations("expenses.categories");
  const locale = useLocale();
  const toast = useToast();
  const { data: categories, isLoading } = useExpenseCategoriesQuery();
  const update = useUpdateExpenseCategoryMutation();
  const remove = useDeleteExpenseCategoryMutation();
  const { confirm, dialog } = useConfirm("expense-category-delete-confirm");
  const [formTarget, setFormTarget] = useState<ExpenseCategoryFormTarget | null>(null);

  async function toggleActive(category: ExpenseCategory, isActive: boolean) {
    try {
      await update.mutateAsync({ id: category.id, input: { isActive } });
      toast.success(isActive ? "expenses.categories.turnedOn" : "expenses.categories.turnedOff");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  }

  function requestDelete(category: ExpenseCategory) {
    confirm({
      title: "expenses.categories.delete.title",
      titleValues: { name: localize(category.name, locale) },
      consequences: [t("delete.consequence")],
      confirmLabel: "expenses.categories.delete.confirm",
      tone: "danger",
      onConfirm: async () => {
        try {
          await remove.mutateAsync(category.id);
          toast.success("expenses.categories.delete.success");
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        data-testid="expense-categories-drawer"
        title={t("title")}
        descriptionKey="expenses.categories.description"
      >
        <div className="flex flex-col gap-4">
          <Button
            variant="secondary"
            data-test-selector="expense-category-add"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setFormTarget({ mode: "create" })}
            className="self-start"
          >
            {t("add")}
          </Button>

          {isLoading ? (
            <Skeleton className="h-48 rounded-panel" />
          ) : (
            <ul className="divide-y divide-line rounded-panel border border-line">
              {(categories ?? []).map((category) => {
                const name = localize(category.name, locale);
                const used = (category.expenseCount ?? 0) > 0;
                return (
                  <li
                    key={category.id}
                    data-test-selector={testSelectorFor("expense-category-row", category.id)}
                    className="flex items-center gap-3 p-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <Typography
                        variant="body"
                        as="span"
                        tone={category.isActive ? undefined : "muted"}
                        className="break-words"
                      >
                        {name}
                      </Typography>
                      <Typography variant="caption" tone="muted" as="span">
                        {t("count", { count: category.expenseCount ?? 0 })}
                      </Typography>
                    </div>
                    <Switch
                      size="sm"
                      data-testid={testSelectorFor("expense-category-active", category.id)}
                      label={t("active", { name })}
                      hideLabel
                      checked={category.isActive}
                      onCheckedChange={(isActive) => void toggleActive(category, isActive)}
                    />
                    <IconButton
                      data-testid={testSelectorFor("expense-category-edit", category.id)}
                      label={t("edit", { name })}
                      icon={<Pencil aria-hidden="true" />}
                      onClick={() => setFormTarget({ mode: "edit", category })}
                    />
                    {!used && (
                      <IconButton
                        tone="danger"
                        data-testid={testSelectorFor("expense-category-delete", category.id)}
                        label={t("delete.label", { name })}
                        icon={<Trash2 aria-hidden="true" />}
                        onClick={() => requestDelete(category)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Typography variant="caption" tone="muted" as="p">
            {t("offHint")}
          </Typography>
        </div>
      </Drawer>
      <ExpenseCategoryFormModal target={formTarget} onClose={() => setFormTarget(null)} />
      {dialog}
    </>
  );
}

function ExpenseCategoryFormModal({
  target,
  onClose,
}: {
  target: ExpenseCategoryFormTarget | null;
  onClose: () => void;
}) {
  const t = useTranslations("expenses.categories.form");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const translateError = useTranslateError();
  const [shown, setShown] = useState(target);
  const [name, setName] = useState<I18n>(EMPTY_NAME);
  const [submitted, setSubmitted] = useState(false);
  if (target && target !== shown) {
    setShown(target);
    setSubmitted(false);
    setName(target.mode === "edit" ? { ...EMPTY_NAME, ...target.category.name } : EMPTY_NAME);
  }
  const editing = shown?.mode === "edit" ? shown.category : undefined;
  const create = useCreateExpenseCategoryMutation();
  const update = useUpdateExpenseCategoryMutation();
  const mutation = editing ? update : create;
  const { reset: resetCreate } = create;
  const { reset: resetUpdate } = update;

  useEffect(() => {
    if (!target) {
      return;
    }
    resetCreate();
    resetUpdate();
  }, [target, resetCreate, resetUpdate]);

  const missing = !name[DEFAULT_LANGUAGE]?.trim();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (missing) {
      return;
    }
    const cleaned = {
      ar: (name.ar ?? "").trim(),
      en: (name.en ?? "").trim() || undefined,
      he: (name.he ?? "").trim() || undefined,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, input: { name: cleaned } });
        toast.success("expenses.categories.form.saved");
      } else {
        await create.mutateAsync({ key: newCategoryKey(), name: cleaned });
        toast.success("expenses.categories.form.created");
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
      data-testid="expense-category-form-modal"
      title={editing ? "expenses.categories.form.editTitle" : "expenses.categories.form.createTitle"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {tCommon("cancel")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            data-test-selector="expense-category-save"
            isLoading={mutation.isPending}
          >
            {t(editing ? "save" : "create")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        {mutation.isError && (
          <Alert tone="danger" data-testid="expense-category-form-error">
            {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
          </Alert>
        )}
        <fieldset className="flex flex-col gap-1.5">
          <Typography as="legend" variant="label" className="mb-1.5">
            {t("name")}
          </Typography>
          <TranslatedField
            data-testid="translated-expense-category-name"
            languages={NAME_LANGUAGES.map((code) => ({ code, name: LOCALE_LABELS[code as AppLocale] ?? code }))}
            values={name}
            hasError={submitted && missing}
            controlProps={(lang) => ({
              "data-test-selector": fieldTestSelector(`name-${lang}`),
              "aria-label": `${t("name")} — ${LOCALE_LABELS[lang as AppLocale] ?? lang}`,
              placeholder: lang === DEFAULT_LANGUAGE ? t("required") : t("optional"),
              value: name[lang as keyof I18n] ?? "",
              onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setName((current) => ({ ...current, [lang]: event.target.value })),
            })}
          />
          {submitted && missing && (
            <Typography variant="small" tone="error" role="alert">
              {t("nameRequired")}
            </Typography>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
