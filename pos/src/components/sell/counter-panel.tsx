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
//
// All of that is worth a panel, and none of it is worth half the screen. It
// used to be laid out like a landing page — a big centred mark, a heading
// under it, a paragraph under that, a button under that, then four full rows
// of shortcuts — which read as the main event when it is really a note pinned
// beside the till. Everything below is the same content, told in about a
// third of the height: the mark sits beside its heading instead of above it,
// and the shortcuts are a wrapped row of caps rather than a stacked list.
export function CounterPanel({ onScanClick }: CounterPanelProps) {
  const t = useTranslations("sell.counter");

  const shortcuts = [
    { key: SELL_SHORTCUT_FOCUS_SEARCH, label: t("shortcuts.focusSearch") },
    { key: SELL_SHORTCUT_SCAN, label: t("shortcuts.scan") },
    { key: SELL_SHORTCUT_CHECKOUT, label: t("shortcuts.checkout") },
    { key: SELL_SHORTCUT_CLEAR, label: t("shortcuts.clear") },
  ];

  return (
    <section className="hidden flex-col gap-4 rounded-xl border border-dashed border-border px-4 py-4 lg:flex">
      {/* The mark and the heading on one line, reading start-to-end, so the
          panel opens with a row rather than with a stack. */}
      <div className="flex items-start gap-3">
        <ScanLine className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("hint")}</p>
        </div>
      </div>

      {/* The camera is the phone's method and the counter's fallback, so it
          keeps a real button here rather than only the icon in the search
          row — a tag the hand scanner refuses is exactly the moment nobody
          wants to go hunting. Full width and thumb-height, because the
          counter is getting a touch monitor and this is the one thing in the
          panel anybody actually presses. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onScanClick}
        data-test-selector="pos-scan-button"
        className="h-11 w-full"
      >
        <Camera aria-hidden="true" />
        {t("camera")}
      </Button>

      {/* A wrapped row, not four rows. Each pair still reads cap-then-meaning
          in the reading direction and so mirrors with the layout on its own;
          `whitespace-nowrap` is what keeps a cap from ever being orphaned from
          the words it belongs to when the row wraps. */}
      <dl className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.key} className="flex items-center gap-1.5 whitespace-nowrap">
            {/* The cap is the label printed on the keyboard, the same in
                every language — the sentence next to it is the translated
                part. dir=ltr so "F9" is never re-ordered in an RTL line. */}
            <dt>
              <kbd
                dir="ltr"
                className="inline-flex min-w-8 items-center justify-center rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-sm"
              >
                {shortcut.key}
              </kbd>
            </dt>
            <dd className="text-muted-foreground">{shortcut.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
