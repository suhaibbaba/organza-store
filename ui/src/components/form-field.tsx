import { Label } from "@radix-ui/react-label";
import type { JSX, ReactNode } from "react";
import type { FieldError } from "react-hook-form";
import { useTranslation } from "@ui/lib/i18n";
import { Icon } from "@ui/components/icon";
import { InfoTip } from "@ui/components/info-tip";
import { cn } from "@ui/lib/cn";
import { validationMessageKey } from "@ui/lib/validation-message";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface FormFieldProps extends TestIdProps {
  label: string;
  labelValues?: Record<string, string | number> | undefined;
  htmlFor: string;
  error?: FieldError | undefined;
  errorKey?: string | undefined;
  hint?: string | undefined;
  hintValues?: Record<string, string | number> | undefined;
  note?: string | undefined;
  noteValues?: Record<string, string | number> | undefined;
  optional?: boolean | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}

export function FormField({
  label,
  labelValues,
  htmlFor,
  error,
  errorKey,
  hint,
  hintValues,
  note,
  noteValues,
  optional = false,
  required = false,
  children,
  "data-testid": testId,
}: FormFieldProps): JSX.Element {
  const { t } = useTranslation();
  const derived = validationMessageKey(error);
  const messageKey =
    derived === "ui.validation.required" ? derived : error ? (errorKey ?? derived) : undefined;
  const errorId = `${htmlFor}-error`;
  const part = parts("form-field", testId ?? `${htmlFor}-field`);

  return (
    <div {...part()} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <Label
          htmlFor={htmlFor}
          {...part("label")}
          className="cursor-pointer text-label font-medium text-ink"
        >
          {t(label, labelValues ?? {})}
          {required && (
            <span {...part("required")} aria-hidden="true" className="ms-1 text-danger-600">
              *
            </span>
          )}
          {optional && (
            <span {...part("optional")} className="ms-1 text-label text-ink-subtle">
              ({t("ui.common.optional")})
            </span>
          )}
        </Label>
        {hint !== undefined && (
          <InfoTip {...part("hint")} label={t("ui.common.moreInfo")}>
            {t(hint, hintValues ?? {})}
          </InfoTip>
        )}
      </div>

      {children}

      {note !== undefined && !messageKey && (
        <p {...part("note")} className="text-label text-ink-muted">
          {t(note, noteValues ?? {})}
        </p>
      )}

      {messageKey !== undefined && (
        <p
          id={errorId}
          {...part("error")}
          role="alert"
          className={cn("flex items-start gap-1.5 text-value leading-label text-danger-700")}
        >
          <Icon name="error" className="mt-0.5 size-4 shrink-0" />
          {t(messageKey)}
        </p>
      )}
    </div>
  );
}
