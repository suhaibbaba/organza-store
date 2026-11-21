"use client";

import { useCallback, useRef, useState } from "react";
import type { Product } from "@store/shared/types/product";
import type { Variant } from "@store/shared/types/variant";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { PRODUCT_LOOKUP_KIND } from "@store/shared/constants/product";
import { toLatinDigits } from "@store/shared/lib/keyboard";
import { ApiError } from "@/lib/api/errors";
import { lookupProductByCode } from "@/lib/api/products";
import { SCAN_DEDUPE_MS } from "@/constants/pos";

export interface AddByCodeResult {
  // Resolved to a single sellable thing and added straight to the cart.
  status: "added";
  code: string;
}

export interface PickVariantResult {
  // A variant-bearing parent's code (numbered-shawl label or shared supplier code): the parent isn't sellable.
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

// One scanned or typed code to a cart line: repeat reads are swallowed and a parent code asks, never guesses.
export function useAddByCode({ onAdd, onOutcome }: UseAddByCodeOptions) {
  const [isLooking, setIsLooking] = useState(false);
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  // Held until another code is read: the tag that raised the question is still under the camera.
  const heldCode = useRef<string | null>(null);

  const submitCode = useCallback(
    async (rawCode: string, options: { dedupe?: boolean } = {}) => {
      // Arabic-Indic digits typed by hand become ASCII, since every barcode and SKU is ASCII.
      const code = toLatinDigits(rawCode.trim());
      if (!code) {
        return;
      }

      // Only the one code the camera keeps re-reading is held; a different code is taken at once.
      if (options.dedupe) {
        if (heldCode.current !== null) {
          if (heldCode.current === code) {
            return;
          }
          // Something else came into frame: the cashier has moved on.
          heldCode.current = null;
        }

        const previous = lastScan.current;
        const now = Date.now();
        if (previous && previous.code === code && now - previous.at < SCAN_DEDUPE_MS) {
          return;
        }
        lastScan.current = { code, at: now };
      }

      setIsLooking(true);
      try {
        const { kind, product, variant } = await lookupProductByCode(code);

        // The backend's verdict, the same side that refuses a sale on the parent, so the two never disagree.
        if (kind === PRODUCT_LOOKUP_KIND.VARIANT_SELECTION) {
          if (options.dedupe) {
            heldCode.current = code;
          }
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
    [onAdd, onOutcome],
  );

  // Opening the scanner is a fresh intention, even for the tag just looked at.
  const resetScanHistory = useCallback(() => {
    lastScan.current = null;
    heldCode.current = null;
  }, []);

  return { submitCode, isLooking, resetScanHistory };
}
