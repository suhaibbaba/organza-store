import { Typography } from "@store/ui";
import type { ReportFactRowProps } from "@/types/report";

export function ReportFactRow({ label, value, hint, name }: ReportFactRowProps) {
  return (
    <div className="flex items-baseline gap-3 py-2.5" data-test-selector={`report-fact-${name}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <Typography variant="body" tone="muted" as="dt">
          {label}
        </Typography>
        {hint && (
          <Typography variant="caption" tone="muted" as="span">
            {hint}
          </Typography>
        )}
      </div>
      <Typography variant="body" weight="semibold" as="dd" className="shrink-0 tabular-nums">
        {value}
      </Typography>
    </div>
  );
}
