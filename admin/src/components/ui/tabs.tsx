"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useLocale } from "next-intl";
import { getTextDirection } from "@/constants/locale";
import type { AppLocale } from "@/i18n/routing";
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

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("inline-flex h-11 items-center gap-1 rounded-lg bg-secondary p-1", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-9 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("mt-3", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
