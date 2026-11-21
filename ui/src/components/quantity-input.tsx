import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@ui/components/input";
import { cn } from "@ui/lib/cn";

export type QuantityInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "dir"
>;

export const QuantityInput = forwardRef<HTMLInputElement, QuantityInputProps>(
  function QuantityInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        data-part="quantity-input"
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        className={cn("tabular-nums", className)}
        {...props}
      />
    );
  },
);
