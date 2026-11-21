"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch, Controller, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert, Button, Card, FormField, Input, SegmentedControl, Select, Switch } from "@store/ui";
import { can } from "@organza/shared/lib/permissions";
import { PALESTINE_PHONE_PREFIXES } from "@organza/shared/constants/phone";
import { LABEL_LIMITS, LABEL_PRINT_MODES } from "@organza/shared/constants/label";
import { IMPLEMENTED_SALE_NOTIFICATION_MODES } from "@organza/shared/constants/push";
import { fieldErrorTestSelector, fieldTestSelector } from "@organza/shared/lib/testSelector";
import type { Setting } from "@organza/shared/types/setting";
import { useSession } from "@/components/providers/session-provider";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useUpdateSettingsMutation } from "@/hooks/use-settings";
import { settingsFormSchema, settingsToFormValues, toUpdatePayload, type SettingsFormValues } from "@/lib/validation/settings-form";
import { LOCALE_LABELS } from "@/constants/locale";
import type { AppLocale } from "@/i18n/routing";
import { NumericInput } from "@/components/fields/numeric-input";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const SUCCESS_MESSAGE_DURATION_MS = 3000;

function localeLabel(code: string): string {
  return LOCALE_LABELS[code as AppLocale] ?? code;
}

// Only on screen in A4 mode.
const A4_SHEET_FIELDS = [
  "labelColumns",
  "labelRows",
  "labelPageMarginTopMm",
  "labelPageMarginRightMm",
  "labelPageMarginBottomMm",
  "labelPageMarginLeftMm",
  "labelGapXMm",
  "labelGapYMm",
] as const satisfies readonly (keyof SettingsFormValues)[];

// Module level so typing never remounts the input mid-keystroke.
function MeasureField({
  id,
  labelKey,
  error,
  disabled,
  registration,
  allowDecimal = true,
  className,
}: {
  id: string;
  labelKey: string;
  error?: string;
  disabled: boolean;
  registration: UseFormRegisterReturn;
  allowDecimal?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <FormField label={labelKey} htmlFor={id}>
        <NumericInput
          id={id}
          allowDecimal={allowDecimal}
          disabled={disabled}
          aria-invalid={!!error}
          {...registration}
        />
        {error && (
          <p className="text-meta text-danger-600" role="alert" data-test-selector="settings-form-error">
            {error}
          </p>
        )}
      </FormField>
    </div>
  );
}

export function SettingsForm({ setting }: { setting: Setting }) {
  const t = useTranslations("settings.form");
  const { user } = useSession();
  const translateError = useTranslateError();
  const canManage = can(user, "settings.manage");

  const [showSaved, setShowSaved] = useState(false);
  const [storeNameLanguage, setStoreNameLanguage] = useState("ar");

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: settingsToFormValues(setting),
  });

  useEffect(() => {
    reset(settingsToFormValues(setting));
  }, [setting, reset]);

  const labelPrintMode = useWatch({ control, name: "labelPrintMode" });
  const isA4Grid = labelPrintMode === "A4_GRID";

  const saleNotificationsEnabled = useWatch({ control, name: "saleNotificationsEnabled" });

  const mutation = useUpdateSettingsMutation();

  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), SUCCESS_MESSAGE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showSaved]);

  function fieldError(name: keyof SettingsFormValues): string | undefined {
    const message = errors[name]?.message;
    return typeof message === "string" ? translateError(message) : undefined;
  }

  // Hidden A4 fields can still block Save, so their error is surfaced on a thermal printer too.
  const hasHiddenSheetError = !isA4Grid && A4_SHEET_FIELDS.some((name) => Boolean(errors[name]));

  async function onSubmit(values: SettingsFormValues) {
    setShowSaved(false);
    try {
      const updated = await mutation.mutateAsync(toUpdatePayload(values));
      reset(settingsToFormValues(updated));
      setShowSaved(true);
    } catch {
      // surfaced below via mutation.isError
    }
  }

  const sectionTitle = "text-section font-semibold text-ink";
  const hint = "text-label text-ink-muted";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pb-6">
      {!canManage && <p className={hint}>{t("readOnlyHint")}</p>}

      <Card className="flex flex-col gap-4">
        <h2 className={sectionTitle}>{t("storeInfoTitle")}</h2>
        <FormField label="settings.form.storeName" htmlFor={`storeName-${storeNameLanguage}`}>
          <SegmentedControl
            data-testid="tab"
            label={t("storeName")}
            options={setting.supportedLanguages.map((lang) => ({ value: lang, label: localeLabel(lang) }))}
            value={storeNameLanguage}
            onChange={setStoreNameLanguage}
          />
          <div data-test-selector={`tab-panel-${storeNameLanguage}`}>
            <Input
              key={storeNameLanguage}
              id={`storeName-${storeNameLanguage}`}
              aria-label={`${t("storeName")} — ${localeLabel(storeNameLanguage)}`}
              placeholder={storeNameLanguage === setting.defaultLanguage ? t("required") : t("optional")}
              hasError={storeNameLanguage === "ar" && !!errors.storeName?.ar}
              disabled={!canManage}
              {...register(`storeName.${storeNameLanguage}` as "storeName.ar")}
            />
          </div>
          {errors.storeName?.ar && (
            <p className="text-meta text-danger-600" role="alert" data-test-selector={fieldErrorTestSelector("storeName")}>
              {translateError(errors.storeName.ar.message ?? "")}
            </p>
          )}
        </FormField>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className={sectionTitle}>{t("regionalTitle")}</h2>
        <FormField label="settings.form.defaultLanguage" htmlFor="defaultLanguage">
          <Controller
            control={control}
            name="defaultLanguage"
            render={({ field }) => (
              <Select
                id="defaultLanguage"
                data-testid={fieldTestSelector("defaultLanguage")}
                disabled={!canManage}
                options={setting.supportedLanguages.map((lang) => ({ value: lang, label: localeLabel(lang) }))}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
        </FormField>

        <FormField label="settings.form.currency" htmlFor="currency" note="settings.form.currencyHint">
          <Input
            id="currency"
            data-test-selector={fieldTestSelector("currency")}
            value={setting.currency}
            disabled
            readOnly
          />
        </FormField>

        <FormField
          label="settings.form.defaultCountryCode"
          htmlFor="defaultCountryCode"
          note="settings.form.defaultCountryCodeHint"
        >
          <Controller
            control={control}
            name="defaultCountryCode"
            render={({ field }) => (
              <Select
                id="defaultCountryCode"
                data-testid={fieldTestSelector("defaultCountryCode")}
                disabled={!canManage}
                options={PALESTINE_PHONE_PREFIXES.map((prefix) => ({ value: prefix, label: prefix }))}
                renderValue={(option) => <span dir="ltr">{option.label}</span>}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
        </FormField>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className={sectionTitle}>{t("inventoryTitle")}</h2>
        <FormField
          label="settings.form.lowStockThreshold"
          htmlFor="lowStockThreshold"
          note={errors.lowStockThreshold ? undefined : "settings.form.lowStockThresholdHint"}
        >
          <NumericInput
            id="lowStockThreshold"
            disabled={!canManage}
            aria-invalid={!!errors.lowStockThreshold}
            {...register("lowStockThreshold")}
          />
          {errors.lowStockThreshold && (
            <p
              className="text-meta text-danger-600"
              role="alert"
              data-test-selector={fieldErrorTestSelector("lowStockThreshold")}
            >
              {translateError(errors.lowStockThreshold.message ?? "")}
            </p>
          )}
        </FormField>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className={sectionTitle}>{t("saleNotificationsTitle")}</h2>
        <p className={hint}>{t("saleNotificationsIntro")}</p>

        <div className="flex items-center justify-between gap-4">
          <label htmlFor="saleNotificationsEnabled" className="flex-1 cursor-pointer text-label font-medium text-ink">
            {t("saleNotificationsEnabled")}
          </label>
          <Controller
            control={control}
            name="saleNotificationsEnabled"
            render={({ field }) => (
              <Switch
                id="saleNotificationsEnabled"
                data-testid={fieldTestSelector("saleNotificationsEnabled")}
                label={t("saleNotificationsEnabled")}
                hideLabel
                disabled={!canManage}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        {/* Only one mode today, so the picker stays hidden until notifications are on. */}
        {saleNotificationsEnabled && (
          <FormField
            label="settings.form.saleNotificationMode"
            htmlFor="saleNotificationMode"
            note="settings.form.saleNotificationModeHint"
          >
            <Controller
              control={control}
              name="saleNotificationMode"
              render={({ field }) => (
                <Select
                  id="saleNotificationMode"
                  data-testid={fieldTestSelector("saleNotificationMode")}
                  disabled={!canManage}
                  options={IMPLEMENTED_SALE_NOTIFICATION_MODES.map((mode) => ({
                    value: mode,
                    label: t(`saleNotificationModeOption.${mode}`),
                  }))}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              )}
            />
          </FormField>
        )}
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className={sectionTitle}>{t("labelsTitle")}</h2>
        <p className={hint}>{t("labelsIntro")}</p>

        <FormField
          label="settings.form.labelPrintMode"
          htmlFor="labelPrintMode"
          note={isA4Grid ? "settings.form.labelPrintModeHintA4Grid" : "settings.form.labelPrintModeHintThermal"}
        >
          <Controller
            control={control}
            name="labelPrintMode"
            render={({ field }) => (
              <Select
                id="labelPrintMode"
                data-testid={fieldTestSelector("labelPrintMode")}
                disabled={!canManage}
                options={LABEL_PRINT_MODES.map((mode) => ({ value: mode, label: t(`labelPrintModeOption.${mode}`) }))}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
        </FormField>

        <fieldset>
          <legend className="mb-2 text-label font-medium text-ink">{t("labelSizeTitle")}</legend>
          <div className="grid grid-cols-2 gap-3">
            <MeasureField
              id="labelWidthMm"
              labelKey="settings.form.labelWidth"
              disabled={!canManage}
              error={fieldError("labelWidthMm")}
              registration={register("labelWidthMm")}
            />
            <MeasureField
              id="labelHeightMm"
              labelKey="settings.form.labelHeight"
              disabled={!canManage}
              error={fieldError("labelHeightMm")}
              registration={register("labelHeightMm")}
            />
          </div>
          <p className={cn("mt-2", hint)}>
            {t("labelSizeHint", { min: LABEL_LIMITS.minDimensionMm, max: LABEL_LIMITS.maxDimensionMm })}
          </p>
        </fieldset>

        {isA4Grid && (
          <div className="flex flex-col gap-5 border-t border-line pt-5">
            <div>
              <h3 className="text-value font-semibold text-ink">{t("labelSheetTitle")}</h3>
              <p className={hint}>{t("labelSheetIntro")}</p>
            </div>

            <fieldset>
              <legend className="mb-2 text-label font-medium text-ink">{t("labelGridTitle")}</legend>
              <div className="grid grid-cols-2 gap-3">
                <MeasureField
                  id="labelColumns"
                  labelKey="settings.form.labelColumns"
                  allowDecimal={false}
                  disabled={!canManage}
                  error={fieldError("labelColumns")}
                  registration={register("labelColumns")}
                />
                <MeasureField
                  id="labelRows"
                  labelKey="settings.form.labelRows"
                  allowDecimal={false}
                  disabled={!canManage}
                  error={fieldError("labelRows")}
                  registration={register("labelRows")}
                />
              </div>
              <p className={cn("mt-2", hint)}>
                {t("labelGridHint", { min: LABEL_LIMITS.minGridCount, max: LABEL_LIMITS.maxGridCount })}
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-label font-medium text-ink">{t("labelMarginsTitle")}</legend>
              <div className="grid grid-cols-2 gap-3">
                <MeasureField
                  id="labelPageMarginTopMm"
                  labelKey="settings.form.labelMarginTop"
                  disabled={!canManage}
                  error={fieldError("labelPageMarginTopMm")}
                  registration={register("labelPageMarginTopMm")}
                />
                <MeasureField
                  id="labelPageMarginBottomMm"
                  labelKey="settings.form.labelMarginBottom"
                  disabled={!canManage}
                  error={fieldError("labelPageMarginBottomMm")}
                  registration={register("labelPageMarginBottomMm")}
                />
                {/* Left/right are sides of the paper, so in RTL the left field moves past the right one. */}
                <MeasureField
                  id="labelPageMarginLeftMm"
                  labelKey="settings.form.labelMarginLeft"
                  className="rtl:order-1"
                  disabled={!canManage}
                  error={fieldError("labelPageMarginLeftMm")}
                  registration={register("labelPageMarginLeftMm")}
                />
                <MeasureField
                  id="labelPageMarginRightMm"
                  labelKey="settings.form.labelMarginRight"
                  disabled={!canManage}
                  error={fieldError("labelPageMarginRightMm")}
                  registration={register("labelPageMarginRightMm")}
                />
              </div>
              <p className={cn("mt-2", hint)}>{t("labelMarginsHint")}</p>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-label font-medium text-ink">{t("labelGapsTitle")}</legend>
              <div className="grid grid-cols-2 gap-3">
                <MeasureField
                  id="labelGapXMm"
                  labelKey="settings.form.labelGapX"
                  disabled={!canManage}
                  error={fieldError("labelGapXMm")}
                  registration={register("labelGapXMm")}
                />
                <MeasureField
                  id="labelGapYMm"
                  labelKey="settings.form.labelGapY"
                  disabled={!canManage}
                  error={fieldError("labelGapYMm")}
                  registration={register("labelGapYMm")}
                />
              </div>
              <p className={cn("mt-2", hint)}>{t("labelGapsHint")}</p>
            </fieldset>
          </div>
        )}
      </Card>

      {canManage && (
        <>
          {hasHiddenSheetError && (
            <Alert tone="danger" data-testid="alert-destructive">
              {t("labelSheetErrorHint")}
            </Alert>
          )}

          {mutation.isError && (
            <Alert tone="danger" data-testid="alert-destructive">
              {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
            </Alert>
          )}
          {showSaved && (
            <Alert tone="success" data-testid="alert-success">
              {t("saved")}
            </Alert>
          )}

          <Button
            type="submit"
            data-test-selector="settings-save"
            isLoading={mutation.isPending}
            className="w-full sm:w-auto sm:self-start"
          >
            {mutation.isPending ? t("saving") : t("save")}
          </Button>
        </>
      )}
    </form>
  );
}
