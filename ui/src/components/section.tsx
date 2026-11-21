"use client";

import { useId, useState, type JSX, type ReactNode } from "react";
import { Icon, type IconName } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type SectionTone = "neutral" | "red" | "blue" | "violet" | "amber" | "green" | "rose";

const TONE_TEXT: Record<SectionTone, string> = {
  neutral: "text-ink-muted",
  red: "text-tint-1-ink",
  blue: "text-tint-2-ink",
  violet: "text-tint-3-ink",
  amber: "text-tint-4-ink",
  green: "text-tint-5-ink",
  rose: "text-tint-6-ink",
};

export interface SectionProps extends TestIdProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: IconName | undefined;
  readonly tone?: SectionTone | undefined;
  readonly action?: ReactNode;
  readonly collapsible?: boolean | undefined;
  readonly defaultOpen?: boolean | undefined;
  // Forces the body open, e.g. while a field inside it has an error.
  readonly forceOpen?: boolean | undefined;
  readonly className?: string | undefined;
  readonly bodyClassName?: string | undefined;
  readonly children?: ReactNode;
}

export function Section({
  title,
  description,
  icon,
  tone = "blue",
  action,
  collapsible = false,
  defaultOpen = true,
  forceOpen = false,
  className,
  bodyClassName,
  children,
  "data-testid": testId,
}: SectionProps): JSX.Element {
  const part = parts("section", testId);
  const bodyId = useId();
  const [toggled, setToggled] = useState(defaultOpen);
  const open = !collapsible || toggled || forceOpen;

  const heading = (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      {icon && <Icon name={icon} className={cn("mt-0.5 size-4.5 shrink-0", TONE_TEXT[tone])} />}
      <span className="flex min-w-0 flex-col gap-0.5 text-start">
        <span {...part("title")} className="text-value font-medium text-ink">
          {title}
        </span>
        {description && <span className="text-label text-ink-muted">{description}</span>}
      </span>
    </span>
  );

  return (
    <section
      {...part()}
      data-state={open ? "open" : "closed"}
      className={cn("rounded-card border border-line bg-surface shadow-card", className)}
    >
      <header
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-[border-color] duration-200",
          open ? "border-b border-line" : "border-b border-transparent",
        )}
      >
        {collapsible ? (
          <button
            type="button"
            {...part("toggle")}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setToggled((value) => !value)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-control focus-visible:bg-neutral-200 focus-visible:text-primary-900"
          >
            {heading}
            <Icon
              name="chevron-down"
              className={cn("size-4 shrink-0 text-ink-muted transition-transform duration-200", open && "rotate-180")}
            />
          </button>
        ) : (
          heading
        )}
        {action}
      </header>
      <div
        id={bodyId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-240 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div {...part("body")} className={cn("flex flex-col gap-4 p-4", bodyClassName)}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
