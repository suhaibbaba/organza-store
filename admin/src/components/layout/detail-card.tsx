"use client";

import { useId, type ReactNode } from "react";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { useSectionCollapsed } from "@/hooks/use-section-collapsed";
import { cn } from "@/lib/utils";

interface DetailCardProps {
  icon: LucideIcon;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  // Also the key the folded state is remembered under on this device.
  "data-testid"?: string;
}

// A titled section that folds: the title is the toggle, the card's own controls hide with its body.
export function DetailCard({ icon: Icon, title, action, className, children, "data-testid": testId }: DetailCardProps) {
  const bodyId = useId();
  const [collapsed, setCollapsed] = useSectionCollapsed(testId);

  return (
    <section
      data-test-selector={testId}
      data-collapsed={collapsed || undefined}
      className={cn(
        "flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card data-[collapsed]:gap-0 data-[collapsed]:pb-5",
        className,
      )}
    >
      <header className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-3">
        <h2 className="min-w-40 flex-1">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            data-test-selector={testId ? `${testId}-toggle` : undefined}
            onClick={() => setCollapsed(!collapsed)}
            className="group/toggle -m-1 flex w-[calc(100%+0.5rem)] min-w-0 cursor-pointer items-center gap-2.5 rounded-control p-1 text-start focus-darken"
          >
            <Icon className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-section font-semibold text-ink">{title}</span>
            {/* Only a folded section shows an arrow, pointing toward the reading end (left in Arabic). */}
            {collapsed && (
              <ChevronLeft
                aria-hidden="true"
                className="size-4 shrink-0 text-ink-faint group-hover/toggle:text-ink-muted ltr:rotate-180"
              />
            )}
          </button>
        </h2>
        {!collapsed && action}
      </header>
      <div id={bodyId} hidden={collapsed} className="contents">
        {children}
      </div>
    </section>
  );
}
