"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch, Controller, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { can } from "@shared/lib/permissions";
import { PALESTINE_PHONE_PREFIXES } from "@shared/constants/phone";
import { LABEL_LIMITS, LABEL_PRINT_MODES } from "@shared/constants/label";
import { IMPLEMENTED_SALE_NOTIFICATION_MODES } from "@shared/constants/push";
import type { Setting } from "@shared/types/setting";
import { useSession } from "@/components/providers/session-provider";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useUpdateSettingsMutation } from "@/hooks/use-settings";
import { settingsFormSchema, settingsToFormValues, toUpdatePayload, type SettingsFormValues } from "@/lib/validation/settings-form";
import { LOCALE_LABELS } from "@/constants/locale";
import type { AppLocale } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const SUCCESS_MESSAGE_DURATION_MS = 3000;

function localeLabel(code: string): string {
  return LOCALE_LABELS[code as AppLocale] ?? code;
}

// The fields that describe an A4 sticker sheet, and are therefore only on
// screen in A4 mode.
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

// One small measurement field (millimetres, or a count of labels). Defined at
// module level so typing in it never remounts the input mid-keystroke.
function MeasureField({
  id,
  label,
  error,
  disabled,
  registration,
  allowDecimal = true,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  disabled: boolean;
  registration: UseFormRegisterReturn;
  allowDecimal?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <NumericInput
        id={id}
        allowDecimal={allowDecimal}
        disabled={disabled}
        aria-invalid={!!error}
        {...registration}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function SettingsForm({ setting }: { setting: Setting }) {
  const t = useTranslations("settings.form");
  const { user } = useSession();
  const translateError = useTranslateError();
  const canManage = can(user, "settings.manage");

  const [showSaved, setShowSaved] = useState(false);

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

  // The sheet fields below only describe A4 stickers, so they stay off the
  // screen on a thermal roll — a shorter form is a clearer form on a phone.
  const labelPrintMode = useWatch({ control, name: "labelPrintMode" });
  const isA4Grid = labelPrintMode === "A4_GRID";

  // With notifications off there is nothing to say about *which* sales.
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

  // A bad number in the sheet fields would otherwise block Save with nothing
  // on screen to fix, since those fields are hidden on a thermal printer.
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pb-6">
      {!canManage && <p className="text-sm text-muted-foreground">{t("readOnlyHint")}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t("storeInfoTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t("storeName")}</Label>
            <Tabs defaultValue="ar">
              <TabsList>
                {setting.supportedLanguages.map((lang) => (
                  <TabsTrigger key={lang} value={lang}>
                    {localeLabel(lang)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {setting.supportedLanguages.map((lang) => (
                <TabsContent key={lang} value={lang}>
                  <Input
                    aria-label={`${t("storeName")} — ${localeLabel(lang)}`}
                    placeholder={lang === setting.defaultLanguage ? t("required") : t("optional")}
                    aria-invalid={lang === "ar" && !!errors.storeName?.ar}
                    disabled={!canManage}
                    {...register(`storeName.${lang}` as "storeName.ar")}
                  />
                </TabsContent>
              ))}
            </Tabs>
            {errors.storeName?.ar && (
              <p className="text-sm text-destructive">{translateError(errors.storeName.ar.message ?? "")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("regionalTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="defaultLanguage">{t("defaultLanguage")}</Label>
            <Controller
              control={control}
              name="defaultLanguage"
              render={({ field }) => (
                <Select id="defaultLanguage" disabled={!canManage} value={field.value} onChange={field.onChange}>
                  {setting.supportedLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {localeLabel(lang)}
                    </option>
                  ))}
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="currency">{t("currency")}</Label>
            <Input id="currency" value={setting.currency} disabled readOnly />
            <p className="text-sm text-muted-foreground">{t("currencyHint")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="defaultCountryCode">{t("defaultCountryCode")}</Label>
            <Controller
              control={control}
              name="defaultCountryCode"
              render={({ field }) => (
                <Select
                  id="defaultCountryCode"
                  dir="ltr"
                  className="text-end"
                  disabled={!canManage}
                  value={field.value}
                  onChange={field.onChange}
                >
                  {PALESTINE_PHONE_PREFIXES.map((prefix) => (
                    <option key={prefix} value={prefix}>
                      {prefix}
                    </option>
                  ))}
                </Select>
              )}
            />
            <p className="text-sm text-muted-foreground">{t("defaultCountryCodeHint")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("inventoryTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="lowStockThreshold">{t("lowStockThreshold")}</Label>
          <NumericInput
            id="lowStockThreshold"
            disabled={!canManage}
            aria-invalid={!!errors.lowStockThreshold}
            {...register("lowStockThreshold")}
          />
          {errors.lowStockThreshold && (
            <p className="text-sm text-destructive">{translateError(errors.lowStockThreshold.message ?? "")}</p>
          )}
          <p className="text-sm text-muted-foreground">{t("lowStockThresholdHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("saleNotificationsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("saleNotificationsIntro")}</p>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="saleNotificationsEnabled" className="flex-1">
              {t("saleNotificationsEnabled")}
            </Label>
            <Controller
              control={control}
              name="saleNotificationsEnabled"
              render={({ field }) => (
                <Switch
                  id="saleNotificationsEnabled"
                  disabled={!canManage}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          {/* Which sales are worth a notification. Only one answer today, so
              it stays off the screen until the switch is on — a select with
              nothing to choose between is noise on a phone. */}
          {saleNotificationsEnabled && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="saleNotificationMode">{t("saleNotificationMode")}</Label>
              <Controller
                control={control}
                name="saleNotificationMode"
                render={({ field }) => (
                  <Select id="saleNotificationMode" disabled={!canManage} value={field.value} onChange={field.onChange}>
                    {IMPLEMENTED_SALE_NOTIFICATION_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {t(`saleNotificationModeOption.${mode}`)}
                      </option>
                    ))}
                  </Select>
                )}
              />
              <p className="text-sm text-muted-foreground">{t("saleNotificationModeHint")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("labelsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">{t("labelsIntro")}</p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="labelPrintMode">{t("labelPrintMode")}</Label>
            <Controller
              control={control}
              name="labelPrintMode"
              render={({ field }) => (
                <Select id="labelPrintMode" disabled={!canManage} value={field.value} onChange={field.onChange}>
                  {LABEL_PRINT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {t(`labelPrintModeOption.${mode}`)}
                    </option>
                  ))}
                </Select>
              )}
            />
            <p className="text-sm text-muted-foreground">
              {isA4Grid ? t("labelPrintModeHintA4Grid") : t("labelPrintModeHintThermal")}
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("labelSizeTitle")}</legend>
            <div className="grid grid-cols-2 gap-3">
              <MeasureField
                id="labelWidthMm"
                label={t("labelWidth")}
                disabled={!canManage}
                error={fieldError("labelWidthMm")}
                registration={register("labelWidthMm")}
              />
              <MeasureField
                id="labelHeightMm"
                label={t("labelHeight")}
                disabled={!canManage}
                error={fieldError("labelHeightMm")}
                registration={register("labelHeightMm")}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("labelSizeHint", { min: LABEL_LIMITS.minDimensionMm, max: LABEL_LIMITS.maxDimensionMm })}
            </p>
          </fieldset>

          {isA4Grid && (
            <div className="flex flex-col gap-5 border-t border-border pt-5">
              <div>
                <h3 className="text-base font-semibold">{t("labelSheetTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("labelSheetIntro")}</p>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t("labelGridTitle")}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <MeasureField
                    id="labelColumns"
                    label={t("labelColumns")}
                    allowDecimal={false}
                    disabled={!canManage}
                    error={fieldError("labelColumns")}
                    registration={register("labelColumns")}
                  />
                  <MeasureField
                    id="labelRows"
                    label={t("labelRows")}
                    allowDecimal={false}
                    disabled={!canManage}
                    error={fieldError("labelRows")}
                    registration={register("labelRows")}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("labelGridHint", { min: LABEL_LIMITS.minGridCount, max: LABEL_LIMITS.maxGridCount })}
                </p>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t("labelMarginsTitle")}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <MeasureField
                    id="labelPageMarginTopMm"
                    label={t("labelMarginTop")}
                    disabled={!canManage}
                    error={fieldError("labelPageMarginTopMm")}
                    registration={register("labelPageMarginTopMm")}
                  />
                  <MeasureField
                    id="labelPageMarginBottomMm"
                    label={t("labelMarginBottom")}
                    disabled={!canManage}
                    error={fieldError("labelPageMarginBottomMm")}
                    registration={register("labelPageMarginBottomMm")}
                  />
                  {/* Left/right are sides of the paper, not of the reading
                      direction, so in RTL the left field is pushed past the
                      right one to keep each on the side it names. */}
                  <MeasureField
                    id="labelPageMarginLeftMm"
                    label={t("labelMarginLeft")}
                    className="rtl:order-1"
                    disabled={!canManage}
                    error={fieldError("labelPageMarginLeftMm")}
                    registration={register("labelPageMarginLeftMm")}
                  />
                  <MeasureField
                    id="labelPageMarginRightMm"
                    label={t("labelMarginRight")}
                    disabled={!canManage}
                    error={fieldError("labelPageMarginRightMm")}
                    registration={register("labelPageMarginRightMm")}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t("labelMarginsHint")}</p>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t("labelGapsTitle")}</legend>
                <div className="grid grid-cols-2 gap-3">
                  <MeasureField
                    id="labelGapXMm"
                    label={t("labelGapX")}
                    disabled={!canManage}
                    error={fieldError("labelGapXMm")}
                    registration={register("labelGapXMm")}
                  />
                  <MeasureField
                    id="labelGapYMm"
                    label={t("labelGapY")}
                    disabled={!canManage}
                    error={fieldError("labelGapYMm")}
                    registration={register("labelGapYMm")}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t("labelGapsHint")}</p>
              </fieldset>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <>
          {hasHiddenSheetError && <Alert variant="destructive">{t("labelSheetErrorHint")}</Alert>}

          {mutation.isError && (
            <Alert variant="destructive">
              {translateError(mutation.error instanceof ApiError ? mutation.error.code : "error.internal")}
            </Alert>
          )}
          {showSaved && <Alert variant="success">{t("saved")}</Alert>}

          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? (
              <>
                <Spinner />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </>
      )}
    </form>
  );
}
