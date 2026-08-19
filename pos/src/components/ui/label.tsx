import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        // No `leading-none`: a 1.0 line box is a third of what Arabic
        // needs, so the label's own descenders (ج ح خ ي) landed outside it
        // and were sliced by anything that clips. The type scale's line
        // height is the right one — see globals.css.
        "text-sm font-medium text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Label };
