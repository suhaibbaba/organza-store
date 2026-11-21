import type { JSX } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Badge } from "@ui/components/badge";
import type { TestIdProps } from "@ui/lib/testid";

export interface TotalBadgeProps extends TestIdProps {
  readonly total: number;
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}

export function TotalBadge({
  total,
  label = "ui.pagination.total",
  className,
  "data-testid": testId,
}: TotalBadgeProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Badge
      tone="wash"
      plain
      className={className === undefined ? "shrink-0" : `shrink-0 ${className}`}
      {...(testId !== undefined && { "data-testid": testId })}
    >
      {t(label, { total, count: total })}
    </Badge>
  );
}
