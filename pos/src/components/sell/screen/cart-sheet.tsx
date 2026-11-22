"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { CartPanel } from "@/components/sell/screen/cart-panel";

type CartSheetProps = Omit<ComponentProps<typeof CartPanel>, "hideTitle" | "className"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Below 1000px: the same cart panel as the side one, risen from under the thumb by the cart bar.
export function CartSheet({ open, onOpenChange, ...panel }: CartSheetProps) {
  const t = useTranslations();

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      name="cart"
      title={t("sell.screen.cartTitle")}
      className="h-[88dvh] gap-0"
      headerClassName="pb-0"
    >
      <CartPanel {...panel} hideTitle className="flex-1 rounded-none border-0 shadow-none" />
    </BottomSheet>
  );
}
