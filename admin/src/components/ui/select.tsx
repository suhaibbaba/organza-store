import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Native <select> — full mobile picker support (large touch target, OS
// wheel/sheet UI) without pulling in a Radix listbox for a simple case.
// The chevron is positioned with logical `end-3`, so it follows the select's
// own writing direction: an LTR select (e.g. the +970 phone prefix, which is
// forced dir="ltr" because its content is Latin digits) keeps the arrow on
// the right, away from the number, while an RTL select mirrors it to the
// left. The wrapper inherits `dir` from the <select>, so pass dir on <Select>
// and both the control and its chevron agree.
function Select({ className, children, dir, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative" dir={dir}>
      <select
        data-slot="select"
        dir={dir}
        className={cn(
          "h-12 w-full appearance-none rounded-lg border border-input bg-background px-4 pe-10 text-base text-foreground",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

export { Select };
