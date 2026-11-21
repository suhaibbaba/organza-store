import { SELECTABLE } from "@organza/shared/lib/nativeGestures";
import { Typography } from "@store/ui";
import { cn } from "@/lib/utils";
import type { CustomerContactRowProps } from "@/types";

// One line of the customer card; selectable, so a number or address can be copied.
export function CustomerContactRow({ icon: Icon, multiline = false, className, children }: CustomerContactRowProps) {
  return (
    <Typography
      as="p"
      variant="small"
      tone="inherit"
      className={cn("flex min-h-9 gap-2", multiline ? "items-start" : "items-center", className)}
      {...SELECTABLE}
    >
      {Icon && <Icon className={cn("size-4 shrink-0 text-primary-700", multiline && "mt-0.5")} aria-hidden="true" />}
      {children}
    </Typography>
  );
}
