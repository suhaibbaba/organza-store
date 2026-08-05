"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
}

interface SheetContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  // "start" = the writing-direction start edge (right in RTL, left in LTR) —
  // matches where a hamburger trigger usually sits.
  side?: "start" | "end";
  closeLabel: string;
}

function SheetContent({
  className,
  children,
  side = "start",
  closeLabel,
  onOpenAutoFocus = focusPanelNotFirstField,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          // pb: iOS home indicator (CLAUDE.md "Mobile input & device
          // specifics") — every sheet ends in a bottom-anchored action row,
          // so this has to live on the shared root, not each call site.
          "fixed inset-y-0 z-50 flex h-full w-5/6 max-w-sm flex-col gap-4 border-border bg-background pb-[var(--safe-bottom)] shadow-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:duration-200 data-[state=open]:duration-300",
          // The slide direction must be logical (`start`/`end`), not physical
          // (`left`/`right`): the panel is pinned with a logical inset, so in
          // RTL a physical slide would fly it in from the opposite edge and
          // across the screen. tw-animate-css's *-start/*-end utilities flip
          // via :dir(), keeping the panel entering from the edge it sits on.
          side === "start" &&
            "start-0 border-e data-[state=closed]:slide-out-to-start data-[state=open]:slide-in-from-start",
          side === "end" &&
            "end-0 border-s data-[state=closed]:slide-out-to-end data-[state=open]:slide-in-from-end",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute end-4 top-4 inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

// Radix opens a dialog by focusing the first focusable thing inside it. When
// that thing is a text box, the phone throws its keyboard open over a screen
// nobody asked to type on — and most of this app is used on a phone
// (CLAUDE.md "Frontend UX").
//
// This is every sheet's default `onOpenAutoFocus`: focus lands on the panel
// itself, so the focus trap and Escape still work, but no keyboard appears
// until someone actually taps a field. A sheet that genuinely wants a field
// focused has to say so by passing its own handler.
function focusPanelNotFirstField(event: Event) {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle };
