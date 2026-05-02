import {
  IconShoppingBag,
  IconCreditCard,
  IconCash,
  IconReceipt2,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface Props {
  currencyCode?: string;
  subtotal: number;
  cartDiscountValue: number;
  cartDiscountType: "fixed" | "percent";
  cartDiscountAmount: number;
  total: number;
  paymentMethod: string;
  canCheckout: boolean;
  processing: boolean;
  onCartDiscountChange: (value: number, type: "fixed" | "percent") => void;
  onPaymentChange: (method: string) => void;
  onCheckout: () => void;
  onClear: () => void;
  cartLength: number;
}

const paymentIcons: Record<string, React.ReactNode> = {
  cash: <IconCash size={18} />,
  card: <IconCreditCard size={18} />,
  other: <IconReceipt2 size={18} />,
};

export function SummaryPanel({
  currencyCode,
  subtotal,
  cartDiscountValue,
  cartDiscountType,
  cartDiscountAmount,
  total,
  paymentMethod,
  canCheckout,
  processing,
  onCartDiscountChange,
  onPaymentChange,
  onCheckout,
  onClear,
  cartLength,
}: Props) {
  const { t } = useTranslation();
  const { format } = useCurrency(currencyCode);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <IconShoppingBag size={18} className="text-primary" />
          <span className="font-bold text-base">{t("summary.title")}</span>
        </div>
        {cartLength > 0 && (
          <Badge variant="default" size="dot">
            {cartLength}
          </Badge>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-5 space-y-5">
          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("summary.subtotal")}
            </span>
            <span className="font-semibold" dir="ltr">
              {format(subtotal)}
            </span>
          </div>

          {/* Cart discount */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              {t("summary.cartDiscount")}
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                value={cartDiscountValue || ""}
                onChange={(e) =>
                  onCartDiscountChange(
                    Number(e.currentTarget.value) || 0,
                    cartDiscountType,
                  )
                }
                min={0}
                placeholder="0"
                className="flex-1"
                dir="ltr"
              />
              <div className="flex rounded-lg border border-border overflow-hidden text-sm flex-shrink-0">
                {(["fixed", "percent"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => onCartDiscountChange(cartDiscountValue, v)}
                    className={`px-3 py-2 font-semibold transition-colors ${cartDiscountType === v ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}
                  >
                    {v === "fixed" ? t("pos.fixed") : "%"}
                  </button>
                ))}
              </div>
            </div>
            {cartDiscountAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("summary.discountAppliedLabel")}
                </span>
                <span className="text-sm font-bold text-destructive" dir="ltr">
                  −{format(cartDiscountAmount)}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Total box */}
          <div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, #235C63, #2d7a83)" }}
          >
            <span className="font-semibold text-white/80 text-sm">
              {t("summary.total")}
            </span>
            <span className="text-2xl font-bold text-white">
              {format(total)}
            </span>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              {t("summary.paymentMethod")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["cash"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => onPaymentChange(method)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-semibold capitalize ${
                    paymentMethod === method
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {paymentIcons[method]}
                  {t(`summary.${method}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-border bg-card space-y-2 flex-shrink-0">
        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={onCheckout}
          disabled={!canCheckout || processing}
          loading={processing}
        >
          {processing
            ? t("summary.processing")
            : `${t("summary.complete")} · ${format(total)}`}
        </Button>
        {cartLength > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <IconTrash size={14} />
            {t("summary.clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
