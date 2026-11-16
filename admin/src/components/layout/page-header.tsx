import type { ReactNode } from "react";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  // The controls that belong to the page as a whole — a filter, an export.
  // On a phone they wrap onto their own line under the title rather than
  // squeezing it, which is what `flex-wrap` is here for.
  actions?: ReactNode;
  // Which page this is the header of — "products", "order-detail". Rendered
  // as `page-header-<name>` (CLAUDE.md "Test selectors"), so a report can say
  // which screen it was taken on.
  name?: string;
  className?: string;
}

// A page's title, its one-line explanation, and the controls that act on the
// whole page — in one row on a desktop, stacked on a phone.
//
// Logical properties only (ms-/me-/ps-/pe-, and here simply `justify-between`
// and `gap`), so the row mirrors itself in Arabic and Hebrew with nothing to
// flip by hand.
export function PageHeader({ title, description, actions, name, className }: PageHeaderProps) {
  return (
    <div
      className={cn("mb-6 flex flex-wrap items-center justify-between gap-3", className)}
      data-test-selector={testSelectorFor("page-header", name)}
    >
      {/* min-w-0: a long Arabic title wraps inside the row instead of pushing
          the row wider than the screen. */}
      <div className="min-w-0">
        <h1 className="text-xl font-semibold" data-test-selector={testSelectorFor("page-title", name)}>
          {title}
        </h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>

      {/* Same reason, plus max-w-full: whatever is handed in here — a row of
          chips that scrolls sideways, a tab strip — is bounded by the header
          rather than allowed to widen the page. */}
      {actions && (
        <div
          className="flex min-w-0 max-w-full flex-wrap items-center gap-2"
          data-test-selector={testSelectorFor("page-actions", name)}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
