"use client";

import { normalizeHexColor } from "@store/shared/lib/pointColors";
import { cn } from "@/lib/utils";

interface ColorInputProps {
  id: string;
  label: string;
  /** Hex, `#RGB` or `#RRGGBB`. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

// The native picker; the hex sits beside it LTR so it can be read out without mirroring.
export function ColorInput({ id, label, value, onChange, disabled, className }: ColorInputProps) {
  // <input type="color"> accepts only #RRGGBB and silently falls back to black otherwise.
  const hex = normalizeHexColor(value) ?? "#000000";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-control border border-line-strong bg-surface p-1.5">
        <input
          id={id}
          type="color"
          value={hex}
          disabled={disabled}
          onChange={(e) => onChange(normalizeHexColor(e.target.value) ?? e.target.value.toUpperCase())}
          className="size-11 shrink-0 cursor-pointer appearance-none rounded-chip border border-line bg-transparent p-0 focus-darken disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span dir="ltr" className="font-mono text-meta text-ink-muted">
          {hex}
        </span>
      </div>
    </div>
  );
}
