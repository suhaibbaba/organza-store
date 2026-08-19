import type { ReactNode } from "react";
import { fieldErrorTestSelector } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

interface FieldErrorProps {
  /**
   * The id of the field this message belongs to. The message is named after
   * it — `field-<id>-error`, next to the field's own `field-<id>` — so a
   * report about "the red line under the phone box" has one name for the box
   * and one for the line (CLAUDE.md "Test selectors").
   */
  field: string;
  children: ReactNode;
  className?: string;
}

// The one line of red under a field. A component rather than a `<p>` copied
// into thirty forms, so the name is applied once and every form written after
// this one inherits it.
export function FieldError({ field, children, className }: FieldErrorProps) {
  return (
    <p className={cn("text-sm text-destructive", className)} data-test-selector={fieldErrorTestSelector(field)}>
      {children}
    </p>
  );
}
