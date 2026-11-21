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
  const compact = title === undefined;

  return (
    <div
      {...part()}
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={cn(
        "flex rounded-toast shadow-toast",
        compact
          ? cn("items-center gap-3 p-4 text-sm leading-[1.5] font-medium", notice.title)
          : cn("items-start gap-5 p-4 text-sm leading-[1.5] sm:px-6 sm:py-5 sm:text-[15px]", notice.text),
        notice.surface,
        className,
      )}
    >
      {glyph !== null && (
        <span
          {...part("icon")}
          aria-hidden="true"
          className={cn("flex shrink-0 items-center", !compact && "h-6 sm:h-[27px]", notice.icon)}
        >
          <Icon name={glyph} className={cn("[stroke-width:2]", compact ? "size-5" : "size-6")} />
        </span>
      )}
      <div {...part("body")} className="flex min-w-0 flex-1 flex-col gap-1.5">
        {title !== undefined && (
          <p className={cn("text-base leading-[1.5] font-semibold sm:text-lg sm:leading-[1.5]", notice.title)}>
            {title}
          </p>
        )}
        {children !== undefined && <div className="[&_a]:underline">{children}</div>}
      </div>
      {action !== undefined && (
        <div {...part("action")} className="shrink-0 self-center">
          {action}
        </div>
      )}
    </div>
  );
}
