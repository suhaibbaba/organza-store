"use client";

import { useTranslations } from "next-intl";
import { Camera, ScanLine } from "lucide-react";
import {
  SELL_SHORTCUT_CHECKOUT,
  SELL_SHORTCUT_CLEAR,
  SELL_SHORTCUT_FOCUS_SEARCH,
  SELL_SHORTCUT_SCAN,
} from "@/constants/pos";
import { Button } from "@/components/ui/button";

interface CounterPanelProps {
  onScanClick: () => void;
}

// What fills the search side of the counter layout between sales.
//
// Only ever on screen from `lg` up, where the cart has a column of its own and
// this one would otherwise be a blank half of the laptop. On a phone the cart
// is the resting state of the whole screen and this never renders at all.
//
// It exists because the hardware scanner is invisible: nothing has focus,
// nothing is blinking, and a cashier who has only ever used the phone has no
// way of knowing the laptop is listening. So the screen says so, and while it
// has the room it also names the keys and keeps the camera one click away for
// the tag the scanner can't read.
export function CounterPanel({ onScanClick }: CounterPanelProps) {
  const t = useTranslations("sell.counter");

  const shortcuts = [
    { key: SELL_SHORTCUT_FOCUS_SEARCH, label: t("shortcuts.focusSearch") },
    { key: SELL_SHORTCUT_SCAN, label: t("shortcuts.scan") },
    { key: SELL_SHORTCUT_CHECKOUT, label: t("shortcuts.checkout") },
    { key: SELL_SHORTCUT_CLEAR, label: t("shortcuts.clear") },
  ];

  return (
    <section className="hidden flex-col gap-6 rounded-xl border border-dashed border-border px-6 py-10 text-center lg:flex">
      <div className="flex flex-col items-center gap-3">
        <ScanLine className="size-10 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      {/* The camera is the phone's method and the counter's fallback, so it
          keeps a real button here rather than only the icon in the search
          row — a tag the hand scanner refuses is exactly the moment nobody
          wants to go hunting. */}
      <div className="flex justify-center">
        <Button type="button" variant="outline" onClick={onScanClick}>
          <Camera aria-hidden="true" />
          {t("camera")}
        </Button>
      </div>

      <dl className="mx-auto flex w-full max-w-sm flex-col gap-2 text-sm">
        {shortcuts.map((shortcut) => (
          // Each row reads start-to-end in the reading direction, so the key
          // and its meaning swap sides with the layout and nothing is
          // mirrored by hand.
          <div key={shortcut.key} className="flex items-center gap-3">
            {/* The cap is the label printed on the keyboard, the same in
                every language — the sentence next to it is the translated
                part. dir=ltr so "F9" is never re-ordered in an RTL line. */}
            <dt className="shrink-0">
              <kbd
                dir="ltr"
                className="inline-flex min-w-12 items-center justify-center rounded-md border border-border bg-card px-2 py-1 font-mono text-xs font-semibold text-foreground shadow-sm"
              >
                {shortcut.key}
              </kbd>
            </dt>
            <dd className="min-w-0 flex-1 text-start text-muted-foreground">{shortcut.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
