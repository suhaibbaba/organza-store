import { Typography } from "@store/ui";
import type { ProductFactProps } from "@/types/product";

export function ProductFact({ icon: Icon, label, children, testId, action }: ProductFactProps) {
  return (
    <div data-test-selector={testId} className="flex min-w-0 items-start gap-3 bg-sunken p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary-700" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Typography as="dt" variant="caption" tone="muted">{label}</Typography>
        <Typography as="dd" variant="body" className="min-w-0 break-words">{children}</Typography>
      </div>
      {action}
    </div>
  );
}
