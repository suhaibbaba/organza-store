import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]",
      "data-[state=open]:animate-in   data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      "duration-300",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

// Content variants — each side has entered + exit
const sheetVariants = cva(
  "fixed z-50 bg-card shadow-2xl focus:outline-none border-border",
  {
    variants: {
      side: {
        top: [
          "inset-x-0 top-0 border-b rounded-b-2xl",
          "data-[state=open]:animate-in   data-[state=open]:slide-in-from-top",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top",
          "duration-300",
        ],
        bottom: [
          "inset-x-0 bottom-0 border-t rounded-t-3xl",
          "data-[state=open]:animate-in   data-[state=open]:slide-in-from-bottom",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          "duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        ],
        left: [
          "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm border-r",
          "data-[state=open]:animate-in   data-[state=open]:slide-in-from-left",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
          "duration-300",
        ],
        right: [
          "inset-y-0 right-0 h-full w-3/4 sm:max-w-sm border-l",
          "data-[state=open]:animate-in   data-[state=open]:slide-in-from-right",
          "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
          "duration-300",
        ],
      },
    },
    defaultVariants: { side: "right" },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  hideClose?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, hideClose, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute right-4 top-[12px] rtl:left-4 rtl:right-auto rounded-lg p-1.5 opacity-60 ring-offset-background transition-all
            hover:opacity-100 hover:bg-accent
            focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <IconX size={18} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 px-5 pt-5 pb-4 border-b border-border flex-shrink-0 mb-3",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-end gap-2 px-5 py-4 border-t border-border mt-auto flex-shrink-0",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-bold leading-none", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
