import * as React from "react";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & { "data-test-selector"?: string };

// Named from its own id, like Input — see the note there.
function Textarea({ className, "data-test-selector": testSelector, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // 16px text like Input, for the same reason: anything smaller makes
        // iOS zoom the page in the moment the field is focused.
        "flex min-h-24 w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
      data-test-selector={testSelector ?? fieldTestSelector(props.id)}
    />
  );
}

export { Textarea };
