import type { ReactNode } from "react";
import { fieldErrorTestSelector } from "@store/shared/lib/testSelector";

// The already-translated message under a field, named `field-<id>-error` (FormField's own error expects a zod type, not our keys).
export function AuthFieldError({ field, children }: { field: string; children: ReactNode }) {
  return (
    <p
      id={`${field}-error`}
      role="alert"
      className="text-meta text-danger-600"
      data-test-selector={fieldErrorTestSelector(field)}
    >
      {children}
    </p>
  );
}
