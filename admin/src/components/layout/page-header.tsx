import type { ReactNode } from "react";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  // Rendered as `page-header-<name>` so a report can say which screen it was taken on.
  name?: string;
  className?: string;
}

// The clinic page header with already-translated text; actions wrap under the title on a phone.
export function PageHeader({ title, description, actions, name, className }: PageHeaderProps) {
  return (
    <div
      className={cn("mb-6 flex flex-wrap items-end justify-between gap-3", className)}
      data-test-selector={testSelectorFor("page-header", name)}
    >
      <div className="min-w-0">
        <h1 className="text-title font-medium text-primary-900" data-test-selector={testSelectorFor("page-title", name)}>
          {title}
        </h1>
        {description && <p className="mt-1 text-value text-ink-muted">{description}</p>}
      </div>

      {actions && (
        <div
          className="flex min-w-0 max-w-full flex-wrap items-center gap-2.5"
          data-test-selector={testSelectorFor("page-actions", name)}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
