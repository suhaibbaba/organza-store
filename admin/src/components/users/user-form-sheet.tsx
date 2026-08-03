"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { can } from "@shared/lib/permissions";
import { ROLES } from "@shared/constants/roles";
import { ERROR_CODES } from "@shared/constants/errors";
import type { User } from "@shared/types/user";
import { useSession } from "@/components/providers/session-provider";
import { useTranslateError } from "@/hooks/use-translate-error";
import { useCreateUserMutation, useUpdateUserMutation } from "@/hooks/use-users";
import { useSettingsQuery } from "@/hooks/use-settings";
import {
  userFormSchema,
  DEFAULT_USER_FORM_VALUES,
  userToFormValues,
  toCreatePayload,
  toUpdatePayload,
  type UserFormValues,
} from "@/lib/validation/user-form";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PhoneField } from "@/components/ui/phone-field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/errors";

interface UserFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user?: User;
}

export function UserFormSheet({ open, onOpenChange, mode, user }: UserFormSheetProps) {
  const t = useTranslations("users.form");
  const tRole = useTranslations("users.role");
  const tCommon = useTranslations("common");
  const translateError = useTranslateError();
  const { user: currentUser } = useSession();
  const canViewSensitive = can(currentUser, "user.viewSensitive");
  const { data: settings } = useSettingsQuery();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: DEFAULT_USER_FORM_VALUES,
  });

  // Sheets stay mounted while closed (for the exit animation), so the form
  // must be re-synced with the target user each time it opens rather than
  // only once on mount (see CategoryFormSheet for the same pattern).
  useEffect(() => {
    if (open) reset(mode === "edit" && user ? userToFormValues(user) : DEFAULT_USER_FORM_VALUES);
  }, [open, mode, user, reset]);

  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation(user?.id ?? "");
  const mutation = mode === "create" ? createMutation : updateMutation;

  async function onSubmit(values: UserFormValues) {
    // Password is required on create but optional on edit (blank = keep
    // current password) — kept as a manual check instead of a second zod
    // schema so the same mounted form doesn't need to swap resolvers.
    if (mode === "create" && !values.password.trim()) {
      setError("password", { type: "manual", message: ERROR_CODES.VALIDATION_REQUIRED });
      return;
    }
    try {
      if (mode === "create") {
        await createMutation.mutateAsync(toCreatePayload(values));
      } else if (user) {
        await updateMutation.mutateAsync(toUpdatePayload(values, canViewSensitive));
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
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{translateError(errors.name.message ?? "")}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            {mode === "create" ? (
              <Input id="email" type="email" dir="ltr" aria-invalid={!!errors.email} {...register("email")} />
            ) : (
              // Email can't be changed after creation (no email field on
              // updateUserSchema) — shown for reference only, kept outside
              // RHF's registered fields so it's never part of the submit.
              <Input id="email" type="email" dir="ltr" value={user?.email ?? ""} disabled readOnly />
            )}
            {mode === "create" ? (
              errors.email && <p className="text-sm text-destructive">{translateError(errors.email.message ?? "")}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("emailHint")}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={mode === "create" ? t("passwordPlaceholderCreate") : t("passwordPlaceholderEdit")}
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-sm text-destructive">{translateError(errors.password.message ?? "")}</p>
            ) : (
              mode === "edit" && <p className="text-sm text-muted-foreground">{t("passwordHintEdit")}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="role">{t("role")}</Label>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select id="role" value={field.value} onChange={field.onChange}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {tRole(r)}
                    </option>
                  ))}
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneField
                  id="phone"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  defaultCountryCode={settings?.defaultCountryCode}
                  ariaInvalid={!!errors.phone}
                  prefixAriaLabel={t("phonePrefixLabel")}
                />
              )}
            />
            {errors.phone && <p className="text-sm text-destructive">{translateError(errors.phone.message ?? "")}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="whatsapp">{t("whatsapp")}</Label>
            <Controller
              control={control}
              name="whatsapp"
              render={({ field }) => (
                <PhoneField
                  id="whatsapp"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  defaultCountryCode={settings?.defaultCountryCode}
                  ariaInvalid={!!errors.whatsapp}
                  prefixAriaLabel={t("phonePrefixLabel")}
                />
              )}
            />
            {errors.whatsapp ? (
              <p className="text-sm text-destructive">{translateError(errors.whatsapp.message ?? "")}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("whatsappHint")}</p>
            )}
          </div>

          {canViewSensitive && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="idNumber">{t("idNumber")}</Label>
              <Input id="idNumber" aria-invalid={!!errors.idNumber} {...register("idNumber")} />
            </div>
          )}

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
