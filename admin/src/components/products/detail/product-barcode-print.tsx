"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Alert, Button, IconButton, Modal } from "@store/ui";
import { useSettingsQuery } from "@/hooks/use-settings";
import { buildLabelLines, countLabels, expandLabels, toLabelGeometry } from "@/lib/labels";
import { LABEL_RUN_MAX } from "@/constants/labels";
import { LabelCopiesList } from "@/components/labels/label-copies-list";
import { LabelPreview } from "@/components/labels/label-preview";
import { LabelPrintPortal } from "@/components/labels/label-print-portal";
import { LabelSheet } from "@/components/labels/label-sheet";
import type { ProductBarcodePrintProps } from "@/types/product";

// This product's labels on the paper set in Settings; one copy each to start, since it is usually a reprint.
export function ProductBarcodePrint({ product }: ProductBarcodePrintProps) {
  const t = useTranslations("products.detail.print");
  const locale = useLocale();
  const { data: settings } = useSettingsQuery();
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const lines = useMemo(() => buildLabelLines(product, locale), [product, locale]);
  const copies = useMemo(
    () => Object.fromEntries(lines.map((line) => [line.key, overrides[line.key] ?? "1"])),
    [lines, overrides]
  );
  const total = countLabels(lines, copies);
  const tooMany = total > LABEL_RUN_MAX;
  const items = useMemo(() => (tooMany ? [] : expandLabels(lines, copies)), [lines, copies, tooMany]);
  const geometry = settings ? toLabelGeometry(settings) : null;

  if (lines.length === 0) return null;

  return (
    <>
      <IconButton
        data-testid="product-barcode-print"
        label={t("open")}
        icon={<Printer aria-hidden="true" />}
        onClick={() => setOpen(true)}
      />
      <Modal
        data-testid="product-barcode-print-dialog"
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title="products.detail.print.title"
        footer={
          <Button
            data-test-selector="product-barcode-print-confirm"
            icon={<Printer className="size-4" aria-hidden="true" />}
            disabled={!geometry || total === 0 || tooMany}
            onClick={() => window.print()}
          >
            {t("print", { count: total })}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {lines.length > 1 && (
            <LabelCopiesList lines={lines} copies={copies} onChange={(key, value) => setOverrides((prev) => ({ ...prev, [key]: value }))} />
          )}
          {tooMany && (
            <Alert tone="danger" data-testid="alert-destructive">
              {t("tooMany", { max: LABEL_RUN_MAX })}
            </Alert>
          )}
          {geometry && items.length > 0 && <LabelPreview items={items} geometry={geometry} />}
        </div>
      </Modal>
      {open && geometry && items.length > 0 && (
        <LabelPrintPortal geometry={geometry}>
          <LabelSheet items={items} geometry={geometry} />
        </LabelPrintPortal>
      )}
    </>
  );
}
