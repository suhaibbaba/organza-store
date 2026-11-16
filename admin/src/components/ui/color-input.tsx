"use client";

import { normalizeHexColor } from "@organza/shared/lib/pointColors";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ColorInputProps {
  id: string;
  label: string;
  /** Hex, `#RGB` or `#RRGGBB` — shown on the swatch and in the picker. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

// A colour, chosen the way the phone already knows how to choose one: the
// native picker, which is a full-screen wheel on iOS and Android rather than
// a hand-rolled grid nobody has seen before. The swatch itself is the 44px
// target, and the hex sits beside it in LTR so a colour can be read out or
// typed into a second device without mirroring.
export function ColorInput({ id, label, value, onChange, disabled, className }: ColorInputProps) {
  // `<input type="color">` accepts only the six-digit form and silently falls
  // back to black for anything else — including the `#abc` the schema allows.
  const hex = normalizeHexColor(value) ?? "#000000";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2 rounded-lg border border-input bg-background p-1.5">
        <input
          id={id}
          type="color"
          value={hex}
          disabled={disabled}
          onChange={(e) => onChange(normalizeHexColor(e.target.value) ?? e.target.value.toUpperCase())}
          className="size-11 shrink-0 cursor-pointer appearance-none rounded-md border border-border bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span dir="ltr" className="font-mono text-sm text-muted-foreground">
          {hex}
        </span>
      </div>
    </div>
  );
}
