"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { can } from "@shared/lib/permissions";
import { PALESTINE_PHONE_PREFIXES } from "@shared/constants/phone";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";

const SUCCESS_MESSAGE_DURATION_MS = 3000;

function localeLabel(code: string): string {
  return LOCALE_LABELS[code as AppLocale] ?? code;
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

  const mutation = useUpdateSettingsMutation();

  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), SUCCESS_MESSAGE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showSaved]);

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

      {canManage && (
        <>
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
