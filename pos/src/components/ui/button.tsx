import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    // A disabled button must LOOK disabled as well as be one. The native
    // `disabled` attribute already refuses clicks, focus and keystrokes, so
    // what CSS owes it is the appearance: dimmed, a cursor that says no, and
    // — the part that was missing — no hover or press feedback, which the
    // `not-disabled:` guard on every variant below provides.
    //
    // `pointer-events-none` used to stand in for all of that. It does block
    // the click, but it also stops the element receiving the pointer at all,
    // so the cursor falls through to the parent and a dead button shows the
    // ordinary arrow — indistinguishable from a live one.
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground not-disabled:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground not-disabled:hover:bg-secondary/80",
        outline:
          "border border-input bg-background not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground",
        ghost: "not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground not-disabled:hover:bg-destructive/90",
        // Giving stock away (spec.md "Gifts"). Its own colour rather than
        // `default`, because the one thing this action must never be
        // mistaken for is completing a sale — and its own colour rather than
        // `destructive`, because handing a piece to a bride is not an error.
        // Only ever the button that COMMITS a gift; the way in is an outline
        // (see CheckoutBar), so the solid violet appears once, on the tap
        // that actually gives the stock away.
        gift: "bg-gift text-gift-foreground not-disabled:hover:bg-gift/90",
        link: "text-primary underline-offset-4 not-disabled:hover:underline",
      },
      size: {
        // Mobile-first: buttons default to a large, thumb-friendly hit area.
        //
        // `min-h` plus real vertical padding, never a bare `h-*`: a button is
        // usually the last child of a scrolling flex column (every sheet ends
        // in one), where a fixed height is only a *hypothetical* size and
        // flex is free to squash it. Padding sets the automatic minimum, so
        // the button keeps its full height under that pressure instead of
        // being pressed into a strip — and grows rather than clipping when a
        // long Arabic label wraps.
        default: "min-h-12 px-5 py-3 text-base [&_svg]:size-5",
        // 44px, the floor CLAUDE.md sets for anything a thumb has to hit
        // — a "small" button is still a button on a phone.
        sm: "min-h-11 px-4 py-2.5 text-sm [&_svg]:size-4",
        icon: "size-12 shrink-0 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
