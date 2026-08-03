import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  tone?: "default" | "warning";
}

export function StatCard({ icon: Icon, label, value, subtitle, href, tone = "default" }: StatCardProps) {
  const content = (
    <>
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          tone === "warning" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-start shadow-sm transition-colors active:bg-accent"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">{content}</div>;
}
