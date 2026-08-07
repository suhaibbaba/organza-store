import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Mobile-first: 48px tall, roomy padding, 16px text (prevents iOS auto-zoom on focus).
        "flex h-12 w-full rounded-lg border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        // A date field keeps the phone's own date picker but not its sizing:
        // on iOS Safari a native date input carries an intrinsic width and
        // ignores `width: 100%`, so inside a narrow panel it pushes the panel
        // sideways instead of shrinking to it. appearance-none + min-w-0 is
        // what makes it behave like every other field here; the picker still
        // opens on tap.
        type === "date" && "appearance-none min-w-0",
        className
      )}
      {...props}
    />
  );
}

export { Input };
