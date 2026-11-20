"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CartPanel } from "@/components/sell/screen/cart-panel";

type CartSheetProps = Omit<ComponentProps<typeof CartPanel>, "hideTitle" | "className"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Below 1000px: the cart panel, risen from under the thumb by the cart bar.
// The same panel as the side one, so the sale ends the same way at every
// width.
export function CartSheet({ open, onOpenChange, ...panel }: CartSheetProps) {
  const t = useTranslations();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        name="cart"
        side="bottom"
        closeLabel={t("common.close")}
        aria-describedby={undefined}
        className="h-[88dvh] gap-0 bg-card"
      >
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2 text-[1.0625rem] font-bold">
            <span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            {t("sell.screen.cartTitle")}
          </SheetTitle>
        </SheetHeader>
        <CartPanel {...panel} hideTitle className="flex-1 rounded-none border-0 shadow-none" />
      </SheetContent>
    </Sheet>
  );
}
