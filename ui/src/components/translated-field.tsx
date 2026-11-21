"use client";

import { useId, useState, type InputHTMLAttributes, type JSX, type TextareaHTMLAttributes } from "react";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { useTranslation } from "@ui/lib/i18n";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface TranslatedFieldLanguage {
  readonly code: string;
  readonly name: string;
}

type ControlProps = InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>;

export interface TranslatedFieldProps extends TestIdProps {
  readonly languages: readonly TranslatedFieldLanguage[];
  readonly controlProps: (code: string) => ControlProps;
  readonly values?: Readonly<Record<string, string | null | undefined>> | undefined;
  readonly multiline?: boolean | undefined;
  readonly rows?: number | undefined;
  readonly hasError?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
}

export function TranslatedField({
  languages,
  controlProps,
  values,
  multiline = false,
  rows = 3,
  hasError = false,
  disabled = false,
  className,
  "data-testid": testId,
}: TranslatedFieldProps): JSX.Element {
  const { t } = useTranslation();
  const part = parts("translated-field", testId);
  const panelId = useId();
  const [primary, ...others] = languages;
  const filled = others.filter((language) => (values?.[language.code] ?? "").trim() !== "").length;
  const [open, setOpen] = useState(filled > 0);

  function row(language: TranslatedFieldLanguage, bordered: boolean): JSX.Element {
    const { className: controlClassName, ...control } = controlProps(language.code);
    const shared = cn(
      "min-w-0 flex-1 border-none bg-transparent px-3.5 text-field text-ink outline-none [unicode-bidi:plaintext]",
      "placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:text-ink-faint",
      controlClassName,
    );

    return (
      <div
        key={language.code}
        {...part(`row-${language.code}`)}
        className={cn("flex items-stretch", bordered && "border-t border-line")}
      >
        <span
          title={language.name}
          className={cn(
            "flex w-14 shrink-0 justify-center border-e border-line text-label text-ink-muted uppercase",
            multiline ? "pt-2.5" : "items-center",
          )}
        >
          {language.code}
        </span>
        {multiline ? (
          <textarea rows={rows} disabled={disabled} {...control} className={cn(shared, "resize-y py-2")} />
        ) : (
          <input type="text" disabled={disabled} {...control} className={cn(shared, "h-(--control-h)")} />
        )}
      </div>
    );
  }

  return (
    <div
      {...part()}
      className={cn(
        "overflow-hidden rounded-control border bg-surface transition-[border-color,box-shadow] duration-150",
        disabled && "border-dashed border-line-strong",
        !disabled && hasError && "border-danger-600 shadow-field-error",
        !disabled && !hasError && "border-line-strong hover:border-neutral-400 focus-within:border-primary-600",
        className,
      )}
    >
      {primary && row(primary, false)}

      <div
        id={panelId}
        {...part("translations")}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-240 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">{others.map((language) => row(language, true))}</div>
      </div>

      {others.length > 0 && (
        <button
          type="button"
          {...part("toggle")}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex h-(--control-h) w-full cursor-pointer items-center gap-2 border-t border-line bg-inset px-3.5 text-label text-ink-muted focus-visible:bg-neutral-300 focus-visible:text-ink"
        >
          <Icon name="globe" className="size-4" />
          <span className="flex-1 text-start">
            {t("ui.translatedField.translations")}
            <span className="ms-2 tabular-nums text-ink-subtle">
              {t("ui.translatedField.filled", { done: filled, total: others.length })}
            </span>
          </span>
          <span className="flex items-center gap-1 text-primary-600">
            {t(open ? "ui.translatedField.hide" : "ui.translatedField.show")}
            <Icon
              name="chevron-down"
              className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
            />
          </span>
        </button>
      )}
    </div>
  );
}
