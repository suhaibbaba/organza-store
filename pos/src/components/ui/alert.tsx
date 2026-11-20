import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-3 rounded-control border p-4 text-sm", {
  variants: {
    variant: {
      default: "border-border bg-soft text-foreground",
      destructive: "border-destructive/20 bg-destructive-soft text-destructive",
      success: "border-success/20 bg-success-soft text-success",
      warning: "border-warning/20 bg-warning-soft text-warning",
      info: "border-info/20 bg-info-soft text-info",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & { "data-test-selector"?: string };

// "The red box says something" is exactly the report this attribute exists to
// make precise, so an alert names itself by KIND — alert-destructive,
// alert-success — and a screen carrying two of them gives each its own name.
function Alert({ className, variant, "data-test-selector": testSelector, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
      data-test-selector={testSelector ?? testSelectorFor("alert", variant ?? "default")}
    />
  );
}

export { Alert };
