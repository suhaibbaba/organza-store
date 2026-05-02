import { IconMinus, IconPlus, IconTrash, IconPhoto } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { CartLine as CartLineType } from "@/types";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface Props {
  item: CartLineType;
  currencyCode?: string;
  onQty: (variantId: string, delta: number) => void;
  onRemove: (variantId: string) => void;
  onDiscount: (
    variantId: string,
    value: number,
    type: "fixed" | "percent",
  ) => void;
  lineTotal: number;
}

export function CartLineRow({
  item,
  currencyCode,
  onQty,
  onRemove,
  onDiscount,
  lineTotal,
}: Props) {
  const { t } = useTranslation();
  const { format } = useCurrency(currencyCode);
  const variantTitle =
    item.variant.title && item.variant.title !== "Default Title"
      ? item.variant.title
      : item.variant.sku || "";

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="flex items-stretch">
        {/* Thumbnail */}
        <div className="w-[72px] min-h-[72px] flex-shrink-0 bg-muted relative overflow-hidden rounded-l-2xl">
          {item.product.thumbnail ? (
            <img
              src={item.product.thumbnail}
              alt={item.product.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="h-full min-h-[72px] flex items-center justify-center">
              <IconPhoto size={22} className="text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {item.product.title}
              </p>
              {variantTitle && (
                <Badge variant="muted" size="sm" className="mt-0.5">
                  {variantTitle}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="font-bold text-sm text-foreground">
                {format(lineTotal)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemove(item.variant.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <IconTrash size={14} />
              </Button>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Qty */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden h-8">
              <button
                onClick={() => onQty(item.variant.id, -1)}
                className="px-2 h-full hover:bg-accent transition-colors border-r border-border"
              >
                <IconMinus size={12} />
              </button>
              <span className="w-8 text-center text-sm font-bold">
                {item.quantity}
              </span>
              <button
                onClick={() => onQty(item.variant.id, 1)}
                className="px-2 h-full hover:bg-accent transition-colors border-l border-border"
              >
                <IconPlus size={12} />
              </button>
            </div>

            <span className="text-xs text-muted-foreground">
              {format(item.unitPrice)} {t("pos.unitPrice")}
            </span>

            {/* Discount */}
            <div className="flex items-center gap-1 ml-auto">
              <Input
                type="number"
                value={item.lineDiscount || ""}
                onChange={(e) =>
                  onDiscount(
                    item.variant.id,
                    Number(e.currentTarget.value) || 0,
                    item.lineDiscountType,
                  )
                }
                min={0}
                placeholder={t("pos.discount")}
                className="w-24 h-8 text-xs text-center px-2"
              />
              <div className="flex rounded-lg border border-border overflow-hidden text-xs h-8">
                {(["fixed", "percent"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() =>
                      onDiscount(item.variant.id, item.lineDiscount, v)
                    }
                    className={`px-2 font-semibold transition-colors ${item.lineDiscountType === v ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
                  >
                    {v === "fixed" ? t("pos.fixed") : t("pos.percent")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
