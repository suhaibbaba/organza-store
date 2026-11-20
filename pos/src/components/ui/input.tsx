import * as React from "react";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

// `data-test-selector` (CLAUDE.md "Test selectors") is declared rather than
// left to the caller's JSX so that the DEFAULT below can exist: any field with
// an id is nameable — `field-<id>` — without anybody writing the name twice,
// and a screen added next year inherits it. An explicit one always wins.
type InputProps = React.ComponentProps<"input"> & { "data-test-selector"?: string };

function Input({ className, type, "data-test-selector": testSelector, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Mobile-first: 48px tall, roomy padding, 16px text (prevents iOS auto-zoom on focus).
        "flex h-12 w-full rounded-control border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground",
        "transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:border-ring focus-visible:shadow-focus",
        "disabled:cursor-not-allowed disabled:bg-soft disabled:text-disabled-foreground",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
      data-test-selector={testSelector ?? fieldTestSelector(props.id)}
    />
  );
}

export { Input };
