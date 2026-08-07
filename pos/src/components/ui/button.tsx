import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Giving stock away (spec.md "Gifts"). Its own colour rather than
        // `default`, because the one thing this action must never be
        // mistaken for is completing a sale — and its own colour rather than
        // `destructive`, because handing a piece to a bride is not an error.
        // Only ever the button that COMMITS a gift; the way in is an outline
        // (see CheckoutBar), so the solid violet appears once, on the tap
        // that actually gives the stock away.
        gift: "bg-gift text-gift-foreground hover:bg-gift/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Mobile-first: buttons default to a large, thumb-friendly hit area.
        default: "h-12 px-5 text-base [&_svg]:size-5",
        sm: "h-10 px-4 text-sm [&_svg]:size-4",
        icon: "size-12 [&_svg]:size-5",
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
