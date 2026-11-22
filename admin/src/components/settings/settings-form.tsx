"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch, Controller, type FieldError, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Alert, FormField, Input, SaveBar, Select, Switch, TranslatedField, Typography, useToast } from "@store/ui";
import { PALESTINE_PHONE_PREFIXES } from "@store/shared/constants/phone";
import { LABEL_LIMITS, LABEL_PRINT_MODES } from "@store/shared/constants/label";
import { IMPLEMENTED_SALE_NOTIFICATION_MODES } from "@store/shared/constants/push";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@store/shared/constants/languages";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import type { Setting } from "@store/shared/types/setting";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useSaveSettingsMutation } from "@/hooks/use-settings";
import {
  settingsFormSchema,
  settingsToFormValues,
  toUpdatePayload,
  type SettingsFormValues,
} from "@/lib/validation/settings-form";
import { LOCALE_LABELS } from "@/constants/locale";
import { fieldErrorKey } from "@/lib/field-error-key";
import type { AppLocale } from "@/i18n/routing";
import { NumericInput } from "@/components/fields/numeric-input";
import { SettingsSection } from "@/components/settings/settings-section";
import { BrandImageField } from "@/components/settings/brand-image-field";
import { ApiError } from "@/lib/api/errors";
import type { BrandImageChange, BrandImageChanges, BrandImageKind } from "@/types/settings";

const NO_IMAGE_CHANGES: BrandImageChanges = { logo: null, favicon: null };

const STORE_NAME_LANGUAGES = [DEFAULT_LANGUAGE, ...SUPPORTED_LANGUAGES.filter((lang) => lang !== DEFAULT_LANGUAGE)];

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

function localeLabel(code: string): string {
  return LOCALE_LABELS[code as AppLocale] ?? code;
}

// Module level so typing never remounts the input mid-keystroke.
function MeasureField({
  id,
  labelKey,
  error,
  registration,
  allowDecimal = true,
  className,
}: {
  id: string;
  labelKey: string;
  error: FieldError | undefined;
  registration: UseFormRegisterReturn;
  allowDecimal?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <FormField label={labelKey} htmlFor={id} error={error} errorKey={fieldErrorKey(error)} required>
        <NumericInput id={id} allowDecimal={allowDecimal} aria-invalid={!!error} placeholder="0" {...registration} />
      </FormField>
    </div>
  );
}

function MeasureGroup({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <Typography as="legend" variant="label" className="mb-1">
        {title}
      </Typography>
      <div className="grid grid-cols-2 gap-3">{children}</div>
      <Typography variant="caption" tone="muted">
        {hint}
      </Typography>
    </fieldset>
  );
}

export function SettingsForm({ setting }: { setting: Setting }) {
  const t = useTranslations("settings.form");
  const toast = useToast();
  const translateError = useTranslateError();
  const noticeRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<BrandImageChanges>(NO_IMAGE_CHANGES);
  const imagesRef = useRef(images);
  const save = useSaveSettingsMutation();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: settingsToFormValues(setting),
  });

  // Re-read only when the row itself changed, so a background refetch never wipes what is being typed.
  useEffect(() => {
    reset(settingsToFormValues(setting));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setting.updatedAt, reset]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      for (const change of Object.values(imagesRef.current)) {
        if (change?.kind === "replace") {
          URL.revokeObjectURL(change.previewUrl);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (save.isError) {
      noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [save.isError]);

  const labelPrintMode = useWatch({ control, name: "labelPrintMode" });
  const saleNotificationsEnabled = useWatch({ control, name: "saleNotificationsEnabled" });
  const storeName = useWatch({ control, name: "storeName" });
  const isA4Grid = labelPrintMode === "A4_GRID";

  const hasChanges = isDirty || images.logo !== null || images.favicon !== null;
  const hasHiddenSheetError = !isA4Grid && A4_SHEET_FIELDS.some((name) => Boolean(errors[name]));
  const labelsHaveError =
    Boolean(errors.labelWidthMm || errors.labelHeightMm) || A4_SHEET_FIELDS.some((name) => Boolean(errors[name]));

  function setImage(kind: BrandImageKind, change: BrandImageChange) {
    setImages((current) => {
      const previous = current[kind];
      if (previous?.kind === "replace" && previous !== change) {
        URL.revokeObjectURL(previous.previewUrl);
      }
      return { ...current, [kind]: change };
    });
  }

  function discard() {
    reset(settingsToFormValues(setting));
    setImage("logo", null);
    setImage("favicon", null);
    save.reset();
  }

  async function onSubmit(values: SettingsFormValues) {
    try {
      await save.mutateAsync({
        payload: isDirty ? toUpdatePayload(values) : null,
        images,
        onImageSaved: (kind) => setImage(kind, null),
      });
      toast.success("settings.form.saved");
    } catch {
      // Shown in the notice area at the top.
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5 pb-24">
      <div ref={noticeRef} className="flex flex-col gap-3 empty:hidden">
        {save.isError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(save.error instanceof ApiError ? save.error.code : "error.internal")}
          </Alert>
        )}
        {hasHiddenSheetError && (
          <Alert tone="danger" data-testid="alert-destructive">
            {t("labelSheetErrorHint")}
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <SettingsSection name="store-info" forceOpen={!!errors.storeName}>
            <fieldset className="flex flex-col gap-1.5">
              <Typography as="legend" variant="label" className="mb-1.5">
                {t("storeName")}
              </Typography>
              <TranslatedField
                data-testid="translated-store-name"
                languages={STORE_NAME_LANGUAGES.map((code) => ({ code, name: localeLabel(code) }))}
                values={storeName}
                hasError={!!errors.storeName?.ar}
                controlProps={(lang) => ({
                  "data-test-selector": fieldTestSelector(`storeName-${lang}`),
                  "aria-label": `${t("storeName")} — ${localeLabel(lang)}`,
                  placeholder: lang === DEFAULT_LANGUAGE ? t("required") : t("optional"),
                  ...register(`storeName.${lang}` as "storeName.ar"),
                })}
              />
              {errors.storeName?.ar && (
                <Typography variant="small" tone="error" role="alert" data-test-selector="field-error-storeName">
                  {translateError(errors.storeName.ar.message ?? "")}
                </Typography>
              )}
            </fieldset>
          </SettingsSection>

          <SettingsSection name="regional">
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <FormField label="settings.form.defaultLanguage" required htmlFor="defaultLanguage">
                <Controller
                  control={control}
                  name="defaultLanguage"
                  render={({ field }) => (
                    <Select
                      id="defaultLanguage"
                      data-testid={fieldTestSelector("defaultLanguage")}
                      options={setting.supportedLanguages.map((lang) => ({ value: lang, label: localeLabel(lang) }))}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  )}
                />
              </FormField>
              <FormField
                label="settings.form.defaultCountryCode"
                required
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
                      options={PALESTINE_PHONE_PREFIXES.map((prefix) => ({ value: prefix, label: prefix }))}
                      renderValue={(option) => <span dir="ltr">{option.label}</span>}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  )}
                />
              </FormField>
              <FormField label="settings.form.currency" required htmlFor="currency" note="settings.form.currencyHint">
                <Input
                  id="currency"
                  data-test-selector={fieldTestSelector("currency")}
                  value={setting.currency}
                  disabled
                  readOnly
                />
              </FormField>
            </div>
          </SettingsSection>

          <SettingsSection name="inventory" forceOpen={!!errors.lowStockThreshold}>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <FormField
                label="settings.form.lowStockThreshold"
                required
                htmlFor="lowStockThreshold"
                note="settings.form.lowStockThresholdHint"
                error={errors.lowStockThreshold}
                errorKey={fieldErrorKey(errors.lowStockThreshold)}
              >
                <NumericInput
                  id="lowStockThreshold"
                  placeholder="3"
                  aria-invalid={!!errors.lowStockThreshold}
                  {...register("lowStockThreshold")}
                />
              </FormField>
            </div>
          </SettingsSection>

          <SettingsSection name="labels" forceOpen={labelsHaveError}>
            <div className="grid grid-cols-1 sm:grid-cols-2">
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
                      options={LABEL_PRINT_MODES.map((mode) => ({
                        value: mode,
                        label: t(`labelPrintModeOption.${mode}`),
                      }))}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  )}
                />
              </FormField>
            </div>

            <MeasureGroup
              title={t("labelSizeTitle")}
              hint={t("labelSizeHint", { min: LABEL_LIMITS.minDimensionMm, max: LABEL_LIMITS.maxDimensionMm })}
            >
              <MeasureField
                id="labelWidthMm"
                labelKey="settings.form.labelWidth"
                error={errors.labelWidthMm}
                registration={register("labelWidthMm")}
              />
              <MeasureField
                id="labelHeightMm"
                labelKey="settings.form.labelHeight"
                error={errors.labelHeightMm}
                registration={register("labelHeightMm")}
              />
            </MeasureGroup>

            {isA4Grid && (
              <div className="flex flex-col gap-5 border-t border-line pt-5">
                <div className="flex flex-col gap-0.5">
                  <Typography variant="h4">{t("labelSheetTitle")}</Typography>
                  <Typography variant="caption" tone="muted">
                    {t("labelSheetIntro")}
                  </Typography>
                </div>

                <MeasureGroup
                  title={t("labelGridTitle")}
                  hint={t("labelGridHint", { min: LABEL_LIMITS.minGridCount, max: LABEL_LIMITS.maxGridCount })}
                >
                  <MeasureField
                    id="labelColumns"
                    labelKey="settings.form.labelColumns"
                    allowDecimal={false}
                    error={errors.labelColumns}
                    registration={register("labelColumns")}
                  />
                  <MeasureField
                    id="labelRows"
                    labelKey="settings.form.labelRows"
                    allowDecimal={false}
                    error={errors.labelRows}
                    registration={register("labelRows")}
                  />
                </MeasureGroup>

                <MeasureGroup title={t("labelMarginsTitle")} hint={t("labelMarginsHint")}>
                  <MeasureField
                    id="labelPageMarginTopMm"
                    labelKey="settings.form.labelMarginTop"
                    error={errors.labelPageMarginTopMm}
                    registration={register("labelPageMarginTopMm")}
                  />
                  <MeasureField
                    id="labelPageMarginBottomMm"
                    labelKey="settings.form.labelMarginBottom"
                    error={errors.labelPageMarginBottomMm}
                    registration={register("labelPageMarginBottomMm")}
                  />
                  {/* Left/right are sides of the paper, so in RTL the left field moves past the right one. */}
                  <MeasureField
                    id="labelPageMarginLeftMm"
                    labelKey="settings.form.labelMarginLeft"
                    className="rtl:order-1"
                    error={errors.labelPageMarginLeftMm}
                    registration={register("labelPageMarginLeftMm")}
                  />
                  <MeasureField
                    id="labelPageMarginRightMm"
                    labelKey="settings.form.labelMarginRight"
                    error={errors.labelPageMarginRightMm}
                    registration={register("labelPageMarginRightMm")}
                  />
                </MeasureGroup>

                <MeasureGroup title={t("labelGapsTitle")} hint={t("labelGapsHint")}>
                  <MeasureField
                    id="labelGapXMm"
                    labelKey="settings.form.labelGapX"
                    error={errors.labelGapXMm}
                    registration={register("labelGapXMm")}
                  />
                  <MeasureField
                    id="labelGapYMm"
                    labelKey="settings.form.labelGapY"
                    error={errors.labelGapYMm}
                    registration={register("labelGapYMm")}
                  />
                </MeasureGroup>
              </div>
            )}
          </SettingsSection>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <SettingsSection name="branding">
            <div className="flex flex-col divide-y divide-line [&>*:not(:first-child)]:pt-5 [&>*:not(:last-child)]:pb-5">
              <BrandImageField
                kind="logo"
                current={setting.logoUrl ? { small: setting.logoUrl, large: setting.logoUrl } : null}
                change={images.logo}
                onChange={(change) => setImage("logo", change)}
                tabLabel={storeName?.[DEFAULT_LANGUAGE] ?? ""}
              />
              <BrandImageField
                kind="favicon"
                current={
                  setting.faviconUrls ? { small: setting.faviconUrls[32], large: setting.faviconUrls[180] } : null
                }
                change={images.favicon}
                onChange={(change) => setImage("favicon", change)}
                tabLabel={storeName?.[DEFAULT_LANGUAGE] ?? ""}
              />
            </div>
          </SettingsSection>

          <SettingsSection name="sale-notifications">
            <Controller
              control={control}
              name="saleNotificationsEnabled"
              render={({ field }) => (
                <Switch
                  id="saleNotificationsEnabled"
                  data-testid={fieldTestSelector("saleNotificationsEnabled")}
                  label={t("saleNotificationsEnabled")}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
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
          </SettingsSection>
        </div>
      </div>

      <SaveBar
        data-testid="settings-save"
        visible={hasChanges || save.isPending}
        saving={save.isPending}
        onSave={() => void handleSubmit(onSubmit)()}
        onDiscard={discard}
      />
    </form>
  );
}
