"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useLocale } from "next-intl";
import { getTextDirection } from "@/constants/locale";
import type { AppLocale } from "@/i18n/routing";
import { useActiveSegmentInView } from "@/lib/segmented-scroll";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { cn } from "@/lib/utils";

// Radix's Tabs.Root defaults `dir` to "ltr" and writes it onto the DOM node,
// which pins the WHOLE panel — triggers, content, and every `rtl:` utility
// inside it — to left-to-right no matter what the page is doing. In an app
// whose default language is Arabic that is backwards everywhere it is used,
// so the direction comes from the locale unless a caller states otherwise.
function Tabs({ dir, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const locale = useLocale() as AppLocale;
  return <TabsPrimitive.Root dir={dir ?? getTextDirection(locale)} {...props} />;
}

// The row is sized to its own labels and never taller than one line. Two
// things make that true and both belong here rather than in each caller:
// the list is an inline-flex that hugs its content (a `grid grid-cols-N`
// would hand "تمت الموافقة" the same width as "مرفوض" and break the long one
// across two lines, leaving the tabs at uneven heights), and it scrolls
// sideways when a narrow phone cannot fit them — with the chosen tab scrolled
// back into view — instead of wrapping or truncating. The scrollbar itself is
// hidden: a 44px strip has no room for one, and the row is scrolled by thumb.
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = useActiveSegmentInView<HTMLDivElement>();
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      {...props}
      ref={listRef}
      className={cn(
        "inline-flex h-11 w-fit max-w-full items-center gap-1 overflow-x-auto overscroll-x-contain rounded-lg bg-secondary p-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    />
  );
}

// Every tab is the same height whatever its label says (h-9, centred by the
// list), sized to that label (no flex-1, which is what forced equal columns),
// and refuses to wrap. `shrink-0` keeps it at its full width once the row
// overflows, so the labels scroll rather than being squeezed. px-2.5 rather
// than px-3: two-tenths of a rem either side is enough to buy the common
// Arabic rows their place on a 360px screen without shrinking the target.
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      // Named by what the tab SELECTS ("tab-ar", "tab-pending"), which is the
      // one thing about it that does not change when the design does.
      data-test-selector={testSelectorFor("tab", props.value)}
      className={cn(
        "inline-flex h-9 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        // ring-inset: the row is a scroll container, so a ring drawn outside
        // the tab's box would be clipped at either end of it.
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      data-test-selector={testSelectorFor("tab-panel", props.value)}
      className={cn("mt-3", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
