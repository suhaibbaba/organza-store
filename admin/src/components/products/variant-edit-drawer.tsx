"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button, Drawer, Switch } from "@store/ui";
import type { Variant } from "@store/shared/types/variant";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { MoneyField } from "@/components/fields/money-field";
import { BarcodeField } from "@/components/products/barcode-field";
import { ImageManager } from "@/components/products/image-manager";
import { formatMoney } from "@/lib/format";
import type { GallerySlot, VariantEditValues } from "@/types/productForm";

interface VariantEditDrawerProps {
  variant: Variant | null;
  title: string;
  values: VariantEditValues | undefined;
  currency: string;
  canSeeCost: boolean;
  canEditDetails: boolean;
  canEditPrice: boolean;
  canHide: boolean;
  canRemove: boolean;
  canDeleteImages: boolean;
  imageSlots: GallerySlot[];
  isSaving: boolean;
  onEditChange: (values: VariantEditValues) => void;
  onImageSlotsChange: (slots: GallerySlot[]) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function VariantEditDrawer({
  variant,
  title,
  values,
  currency,
  canSeeCost,
  canEditDetails,
  canEditPrice,
  canHide,
  canRemove,
  canDeleteImages,
  imageSlots,
  isSaving,
  onEditChange,
  onImageSlotsChange,
  onRemove,
  onClose,
}: VariantEditDrawerProps) {
  const t = useTranslations("products.form.variants");
  const tImages = useTranslations("products.form.images");
  const locale = useLocale();

  return (
    <Drawer
      data-testid="variant-edit-drawer"
      open={variant !== null && values !== undefined}
      onOpenChange={(open) => !open && onClose()}
      title={title}
      descriptionKey="products.form.variants.drawerDescription"
      footer={
        canEditDetails &&
        canRemove && (
            <Button
              variant="quiet"
              data-testid="variant-edit-remove"
              className="text-danger-600 hover:bg-danger-50 hover:text-danger-600"
              icon={<Trash2 className="size-4" aria-hidden="true" />}
              onClick={() => {
                onRemove();
                onClose();
              }}
            >
              {t("removeCombo")}
            </Button>
        )
      }
    >
      {variant && values && (
        <div className="flex flex-col gap-5">
          {canEditDetails && canHide && (
            <div className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2.5">
              <label htmlFor={`active-${variant.id}`} className="text-label text-ink">
                {t("active")}
              </label>
              <Switch
                id={`active-${variant.id}`}
                data-testid={fieldTestSelector(`active-${variant.id}`)}
                label={t("active")}
                hideLabel
                checked={values.isActive}
                onCheckedChange={(checked) => onEditChange({ ...values, isActive: checked })}
              />
            </div>
          )}

          {canEditDetails && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {canEditPrice ? (
                <Field id={`price-${variant.id}`} label={t("priceOverride")}>
                  <MoneyField
                    id={`price-${variant.id}`}
                    placeholder={t("inherits", { value: formatMoney(variant.resolvedPrice, currency, locale) })}
                    value={values.priceOverride}
                    onChange={(e) => onEditChange({ ...values, priceOverride: e.target.value })}
                  />
                </Field>
              ) : (
                <Field label={t("priceOverride")}>
                  <p className="text-value text-ink tabular-nums">{formatMoney(variant.resolvedPrice, currency, locale)}</p>
                </Field>
              )}
              {canSeeCost && (
                <Field id={`cost-${variant.id}`} label={t("cost")}>
                  <MoneyField
                    id={`cost-${variant.id}`}
                    placeholder={
                      variant.resolvedCost
                        ? t("inherits", { value: formatMoney(variant.resolvedCost, currency, locale) })
                        : undefined
                    }
                    value={values.cost}
                    onChange={(e) => onEditChange({ ...values, cost: e.target.value })}
                  />
                </Field>
              )}
            </div>
          )}

          {canEditDetails && (
            <BarcodeField
              id={`barcode-${variant.id}`}
              compact
              source={values.barcodeSource}
              value={values.barcode}
              onChange={({ source, value }) => onEditChange({ ...values, barcodeSource: source, barcode: value })}
              currentCode={variant.barcode}
              disabled={isSaving}
            />
          )}

          <div className="flex flex-col gap-2">
            <span className="text-label text-ink">{tImages("variantSectionTitle")}</span>
            <ImageManager
              slots={imageSlots}
              onChange={onImageSlotsChange}
              canDelete={canDeleteImages}
              isBusy={isSaving}
              emptyHint={tImages("variantFallbackHint")}
            />
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Field({ id, label, children }: { id?: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {id ? (
        <label htmlFor={id} className="text-label text-ink">
          {label}
        </label>
      ) : (
        <span className="text-label text-ink">{label}</span>
      )}
      {children}
    </div>
  );
}
