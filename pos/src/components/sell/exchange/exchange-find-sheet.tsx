"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, CameraOff, Repeat } from "lucide-react";
import { Button, SearchField, Spinner, Typography } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { BarcodeScanner } from "@/components/sell/scanner/barcode-scanner";
import { ExchangeSaleRow } from "@/components/sell/exchange/exchange-sale-row";
import { ExchangePiecePicker } from "@/components/sell/exchange/exchange-piece-picker";
import { useExchangeSearch } from "@/hooks/use-exchange-search";
import { useHardwareScanner } from "@/hooks/use-hardware-scanner";
import { classifyExchangeSearch } from "@/lib/exchange";
import type { ExchangeDraft } from "@/types/exchange";

interface ExchangeFindSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Reopened from the cart's banner: straight back to the chosen sale and its pieces.
  draft: ExchangeDraft | null;
  onConfirm: (draft: ExchangeDraft) => void;
}

// Step one of an exchange: find the sale (number, a piece's code, or the recent history), then tick what is coming back.
export function ExchangeFindSheet(props: ExchangeFindSheetProps) {
  // Mounted only while open, so each exchange starts from the history.
  return props.open ? <ExchangeFindForm {...props} /> : null;
}

function ExchangeFindForm({ open, onOpenChange, draft, onConfirm }: ExchangeFindSheetProps) {
  const t = useTranslations("sell.exchange");
  const tSearch = useTranslations("sell.search");
  const [orderId, setOrderId] = useState<string | null>(draft?.order.id ?? null);
  const [text, setText] = useState("");
  // A scanned label is always a piece's code, however short.
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  const search = scannedCode ? { itemCode: scannedCode } : classifyExchangeSearch(text);
  const results = useExchangeSearch(search, orderId === null);
  const isFiltered = Boolean(search.q || search.itemCode);

  function scanned(code: string) {
    setScannedCode(code);
    setText(code);
    setCameraOn(false);
  }

  // While finding the sale the counter scanner fills this search, never the cart behind the sheet.
  useHardwareScanner({ enabled: open && orderId === null, onScan: scanned });

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      name="exchange-find"
      className="mx-auto h-[85dvh] max-h-[94dvh] max-w-3xl tab:rounded-t-card tab:border-x"
      headerClassName="pb-0"
      title={
        <span className="flex items-center gap-2">
          <Repeat className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
          {t("title")}
        </span>
      }
      description={orderId ? t("pickSubtitle") : t("findSubtitle")}
    >
      {orderId ? (
        <ExchangePiecePicker
          orderId={orderId}
          initialReturns={draft?.order.id === orderId ? draft.returns : []}
          onBack={() => setOrderId(null)}
          onConfirm={onConfirm}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Pinned: the search and camera stay in reach however far the history is scrolled. */}
          <div className="flex shrink-0 flex-col gap-2 border-b border-line px-5 pb-4">
            <div className="flex items-end gap-2">
              <SearchField
                id="pos-exchange-search"
                label={t("searchLabel")}
                data-testid={fieldTestSelector("pos-exchange-search")}
                value={text}
                placeholder={t("searchPlaceholder")}
                onChange={(event) => {
                  setScannedCode(null);
                  setText(event.target.value);
                }}
                onClear={() => {
                  setScannedCode(null);
                  setText("");
                }}
                clearLabel={tSearch("clear")}
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCameraOn((on) => !on)}
                data-testid="pos-exchange-camera"
                icon={cameraOn ? <CameraOff aria-hidden="true" /> : <Camera aria-hidden="true" />}
                className="shrink-0"
              >
                {cameraOn ? t("cameraOff") : t("cameraOn")}
              </Button>
            </div>
            <Typography variant="caption" tone="muted">
              {t("searchHint")}
            </Typography>

            {cameraOn && <BarcodeScanner onDetected={scanned} pulse={null} />}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-4 [&>*]:shrink-0">
            <div className="flex items-center justify-between gap-2">
              <Typography as="h3" variant="small" weight="medium">
                {search.itemCode ? t("withPiece", { code: search.itemCode }) : isFiltered ? t("matches") : t("recent")}
              </Typography>
              {(results.isFetching || results.isTyping) && <Spinner />}
            </div>

            {results.isError ? (
              <Typography variant="small" tone="error" data-test-selector="pos-exchange-search-error">
                {t("searchFailed")}
              </Typography>
            ) : results.orders.length === 0 && !results.isPending ? (
              <Typography variant="small" tone="muted" data-test-selector="pos-exchange-search-empty">
                {isFiltered ? t("noMatches") : t("noSales")}
              </Typography>
            ) : (
              <ul className="flex flex-col gap-2" data-test-selector="pos-exchange-sales">
                {results.orders.map((order) => (
                  <li key={order.id}>
                    <ExchangeSaleRow order={order} onSelect={() => setOrderId(order.id)} />
                  </li>
                ))}
              </ul>
            )}

            {results.hasNextPage && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void results.fetchNextPage()}
                isLoading={results.isFetchingNextPage}
                data-testid="pos-exchange-more"
                className="self-center"
              >
                {t("showMore")}
              </Button>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
