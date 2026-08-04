import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ReportFigureProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  // The one number the card is about — rendered large enough to read at
  // arm's length, which is how a shop owner checks the day's takings.
  size?: "hero" | "normal";
  // A small colour chip tying the figure to its series in the chart above.
  // Identity is always carried by the label too, never by colour alone.
  seriesColor?: string;
}

export function ReportFigure({ label, value, hint, size = "normal", seriesColor }: ReportFigureProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-2">
        {seriesColor && (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: seriesColor }}
            aria-hidden="true"
          />
        )}
        <p className="truncate text-sm text-muted-foreground">{label}</p>
      </div>
      <p className={cn("font-bold text-foreground", size === "hero" ? "text-3xl" : "text-xl")}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
