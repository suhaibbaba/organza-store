import type { JSX, ReactNode } from "react";
import type { BadgeTone } from "@ui/components/badge";
import { Icon, type IconName } from "@ui/components/icon";
import { TONE_SURFACE } from "@ui/components/tone";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type AlertTone = BadgeTone;

const ICONS: Record<AlertTone, IconName> = {
  neutral: "info",
  info: "info",
  success: "check",
  warning: "alert",
  danger: "error",
};

export interface AlertProps extends TestIdProps {
  readonly tone?: AlertTone | undefined;
  /** Already translated: an alert says something about this screen, in its words. */
  readonly title?: ReactNode | undefined;
  readonly icon?: IconName | false | undefined;
  readonly action?: ReactNode | undefined;
  readonly className?: string | undefined;
  readonly children?: ReactNode | undefined;
}

export function Alert({
  tone = "info",
  title,
  icon,
  action,
  className,
  children,
  "data-testid": testId,
}: AlertProps): JSX.Element {
  const part = parts("alert", testId);
  const glyph = icon === false ? null : (icon ?? ICONS[tone]);

  return (
    <div
      {...part()}
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={cn("flex items-start gap-3 rounded-panel border p-3.5 text-label", TONE_SURFACE[tone], className)}
    >
      {glyph !== null && <Icon {...part("icon")} name={glyph} className="mt-0.5 size-4 shrink-0" />}
      <div {...part("body")} className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title !== undefined && <p className="font-semibold">{title}</p>}
        {children !== undefined && <div className="text-ink-muted [&_a]:underline">{children}</div>}
      </div>
      {action !== undefined && <div {...part("action")} className="shrink-0">{action}</div>}
    </div>
  );
}
