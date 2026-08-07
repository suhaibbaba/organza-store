"use client";

import { useCallback, useRef, useState } from "react";
import type { Product } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import { ERROR_CODES } from "@shared/constants/errors";
import { ApiError } from "@/lib/api/errors";
import { lookupProductByCode } from "@/lib/api/products";
import { toLatinDigits } from "@/lib/keyboard";
import { SCAN_DEDUPE_MS } from "@/constants/pos";

export interface AddByCodeResult {
  // Resolved to a single sellable thing and added straight to the cart.
  status: "added";
  code: string;
}

export interface PickVariantResult {
  // The code named a variant-bearing product (its parent barcode), so the
  // cashier still has to say which variant — the parent isn't sellable.
  status: "pick";
  product: Product;
}

export interface CodeErrorResult {
  status: "error";
  // A backend error code (error.*), translated by the caller via t().
  code: string;
}

export type CodeOutcome = AddByCodeResult | PickVariantResult | CodeErrorResult;

interface UseAddByCodeOptions {
  onAdd: (product: Product, variant: Variant | null) => void;
  onOutcome: (outcome: CodeOutcome) => void;
}

// Turns one code — scanned by the camera or typed in by hand — into a cart
// line. Everything that makes scanning feel reliable at a counter lives
// here: repeat reads of the same barcode are swallowed, and a code that
// lands on a variant-bearing parent asks rather than guessing.
export function useAddByCode({ onAdd, onOutcome }: UseAddByCodeOptions) {
  const [isLooking, setIsLooking] = useState(false);
  // The camera reports the same barcode many times a second while it stays
  // in frame; without this, one item would land in the cart a dozen times.
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  // A code the cashier has already been asked a question about (which
  // variant?). Held until some other code is read, because the tag that
  // raised the question is still lying under the camera when it comes back
  // — and asking the same question again, and again, is a trap the cashier
  // cannot scan their way out of. Cleared outright when they open the
  // scanner themselves, so deliberately scanning that same tag again works.
  const heldCode = useRef<string | null>(null);

  const submitCode = useCallback(
    async (rawCode: string, options: { dedupe?: boolean } = {}) => {
      // `٤٠١٢` is 4012. A cashier reading a torn label out by hand types it
      // on the Arabic keyboard they already have, whose digit row sends
      // Arabic-Indic digits — and every barcode and SKU in the catalogue is
      // ASCII, so the lookup would answer "no such product" for a code they
      // typed perfectly correctly. Both scanners send ASCII already, so this
      // only ever changes the hand-typed path.
      const code = toLatinDigits(rawCode.trim());
      if (!code) return;

      // Only what the camera keeps re-reading is held back, and only that
      // one code: the moment a different barcode comes into frame it is
      // taken with no wait at all, so scanning a pile of items one after
      // another is never slowed down. Re-scanning the same tag on purpose
      // (a second identical piece) works too — it just has to be after the
      // window the cart line's little bar is counting down.
      if (options.dedupe) {
        if (heldCode.current !== null) {
          if (heldCode.current === code) return;
          // Something else came into frame: the cashier has moved on.
          heldCode.current = null;
        }

        const previous = lastScan.current;
        const now = Date.now();
        if (previous && previous.code === code && now - previous.at < SCAN_DEDUPE_MS) return;
        lastScan.current = { code, at: now };
      }

      setIsLooking(true);
      try {
        const { product, variant } = await lookupProductByCode(code);

        if (!variant && product.hasVariants) {
          // See heldCode above: the camera is about to be handed back after
          // the cashier answers, with this same tag still in front of it.
          if (options.dedupe) heldCode.current = code;
          onOutcome({ status: "pick", product });
          return;
        }

        onAdd(product, variant);
        onOutcome({ status: "added", code });
      } catch (error) {
        onOutcome({
          status: "error",
          code: error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL,
        });
      } finally {
        setIsLooking(false);
      }
    },
    [onAdd, onOutcome]
  );

  // Called when the cashier opens the scanner themselves: whatever they
  // point it at next is a fresh intention, even if it is the tag they were
  // just looking at.
  const resetScanHistory = useCallback(() => {
    lastScan.current = null;
    heldCode.current = null;
  }, []);

  return { submitCode, isLooking, resetScanHistory };
}
