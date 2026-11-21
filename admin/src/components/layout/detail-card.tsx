import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailCardProps {
  icon: LucideIcon;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  "data-testid"?: string;
}

// A record page's section: icon + title on top, roomy body under it.
export function DetailCard({ icon: Icon, title, action, className, children, "data-testid": testId }: DetailCardProps) {
  return (
    <section
      data-test-selector={testId}
      className={cn("flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card", className)}
    >
      <header className="flex items-center gap-2.5">
        <Icon className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-section font-semibold text-ink">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
