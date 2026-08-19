"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & { "data-test-selector"?: string };

// Named from its own id, like Input — see the note there.
function Checkbox({ className, "data-test-selector": testSelector, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Mobile-first: 24px box inside a larger tap target via the label wrapper.
        "peer size-6 shrink-0 rounded-md border border-input bg-background transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className
      )}
      {...props}
      data-test-selector={testSelector ?? fieldTestSelector(props.id)}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-4" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
