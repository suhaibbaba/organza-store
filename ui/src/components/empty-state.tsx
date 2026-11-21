import type { JSX, ReactNode } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Icon, type IconName } from "@ui/components/icon";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface EmptyStateProps extends TestIdProps {
  title: string;
  hint?: string | undefined;
  action?: ReactNode | undefined;
  icon?: IconName | undefined;
  titleAs?: "p" | "h1" | "h2" | "h3" | undefined;
}

export function EmptyState({
  title,
  hint,
  action,
  icon = "file",
  titleAs: Title = "p",
  "data-testid": testId,
}: EmptyStateProps): JSX.Element {
  const { t } = useTranslation();
  const part = parts("empty-state", testId);

  return (
    <div {...part()} className="rounded-card border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <span
        {...part("icon")}
        className="mx-auto mb-3 flex size-11 items-center justify-center rounded-field bg-primary-100 text-primary-700"
      >
        <Icon name={icon} size="md" />
      </span>

      <Title {...part("title")} className="text-section font-medium text-ink">
        {t(title)}
      </Title>
      {hint !== undefined && (
        <p {...part("hint")} className="mt-1 text-label text-ink-muted">
          {t(hint)}
        </p>
      )}
      {action !== undefined && (
        <div {...part("action")} className="mt-4 flex justify-center">
          {action}
        </div>
      )}
    </div>
  );
}
