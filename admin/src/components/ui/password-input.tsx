"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A password box with an eye on it.
//
// Every password field in the app is one of these, because the alternative on
// a phone is typing eight or more characters you cannot see, on a keyboard
// that hides half of them behind a shift key — and then being told, with no
// detail, that they were wrong. Whoever is standing at the counter is not
// going to enjoy guessing which character they fat-fingered.
//
//   * it starts HIDDEN, always. Revealing is a deliberate tap, never a state
//     the screen can be left in by a previous user or a stray prop;
//   * the button carries a real label ("show/hide password" through t(), like
//     everything else) and `aria-pressed`, so a screen reader announces both
//     what it does and which way it currently is — an eye glyph alone says
//     neither;
//   * it is 44px, sits at the END of the field (`end-*`, so it mirrors into
//     the correct corner in Arabic and Hebrew) and the field pads out of its
//     way with `pe-*` rather than a hard-coded right padding;
//   * `type="button"` — these live inside forms, and a bare button in a form
//     submits it.
//
// forwardRef because every caller reaches it through react-hook-form's
// `register()`, which hands the ref down to the real input.
export type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, ...props },
  ref
) {
  const t = useTranslations("common.password");
  const [revealed, setRevealed] = React.useState(false);

  return (
    <div className="relative">
      <Input ref={ref} type={revealed ? "text" : "password"} className={cn("pe-14", className)} {...props} />
      <button
        type="button"
        onClick={() => setRevealed((current) => !current)}
        aria-label={t(revealed ? "hide" : "show")}
        aria-pressed={revealed}
        className="absolute end-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {revealed ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </div>
  );
});
