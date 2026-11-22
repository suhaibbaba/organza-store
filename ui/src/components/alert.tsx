import type { JSX, ReactNode } from "react";
import type { BadgeTone } from "@ui/components/badge";
import { Icon, type IconName } from "@ui/components/icon";
import { NOTICE_TONES } from "@ui/components/tone";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type AlertTone = BadgeTone;

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
  const notice = NOTICE_TONES[tone];
  const glyph = icon === false ? null : (icon ?? notice.glyph);

  return (
    <div
      {...part()}
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={cn(
        "flex w-fit max-w-full items-start gap-2.5 self-start rounded-control border px-3 py-2.5 text-sm leading-5",
        notice.tint,
        notice.text,
        className,
      )}
    >
      {glyph !== null && (
        <span {...part("icon")} aria-hidden="true" className={cn("flex h-5 shrink-0 items-center", notice.icon)}>
          <Icon name={glyph} className="size-4 [stroke-width:2.25]" />
        </span>
      )}
      <div {...part("body")} className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title !== undefined && <p className={cn("font-semibold", notice.title)}>{title}</p>}
        {children !== undefined && <div className="[&_a]:font-medium [&_a]:underline">{children}</div>}
      </div>
      {action !== undefined && (
        <div {...part("action")} className="-my-1 shrink-0 self-center">
          {action}
        </div>
      )}
    </div>
  );
}
