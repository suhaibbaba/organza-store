"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & { "data-test-selector"?: string };

// Named from its own id, like Input — see the note there.
function Switch({ className, "data-test-selector": testSelector, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent bg-input transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary",
        className
      )}
      {...props}
      data-test-selector={testSelector ?? fieldTestSelector(props.id)}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-6 rounded-full bg-background shadow-sm ring-0 transition-transform",
          "translate-x-0.5 data-[state=checked]:translate-x-[1.375rem] rtl:data-[state=checked]:-translate-x-[1.375rem]"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
