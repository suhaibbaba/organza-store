import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, TestIdProps {
  hasError?: boolean | undefined;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, hasError = false, rows = 3, "data-testid": testId, ...props },
  ref,
) {
  const disabled = props.disabled === true;

  return (
    <textarea
      ref={ref}
      {...parts("textarea", testId)()}
      rows={rows}
      aria-invalid={hasError || undefined}
      className={cn(
        "block min-h-(--control-h) max-h-60 w-full resize-y overflow-y-auto rounded-control border px-3.5 py-2.5",
        "[unicode-bidi:plaintext] page-rtl:text-right page-ltr:text-left",
        "text-field text-ink placeholder:text-ink-subtle",
        "transition-[border-color,box-shadow,background-color] duration-150 outline-none",
        disabled
          ? "cursor-not-allowed border-dashed border-line-strong bg-surface text-ink-faint"
          : cn(
              "bg-surface",
              hasError
                ? "border-danger-600 shadow-field-error"
                : "border-line-strong hover:border-neutral-400 focus:border-primary-600",
            ),
        className,
      )}
      {...props}
    />
  );
});
