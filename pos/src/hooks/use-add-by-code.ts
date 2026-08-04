"use client";

import { useCallback, useRef, useState } from "react";
import type { Product } from "@shared/types/product";
import type { Variant } from "@shared/types/variant";
import { ERROR_CODES } from "@shared/constants/errors";
import { ApiError } from "@/lib/api/errors";
import { lookupProductByCode } from "@/lib/api/products";
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

  const submitCode = useCallback(
    async (rawCode: string, options: { dedupe?: boolean } = {}) => {
      const code = rawCode.trim();
      if (!code) return;

      if (options.dedupe) {
        const previous = lastScan.current;
        const now = Date.now();
        if (previous && previous.code === code && now - previous.at < SCAN_DEDUPE_MS) return;
        lastScan.current = { code, at: now };
      }

      setIsLooking(true);
      try {
        const { product, variant } = await lookupProductByCode(code);

        if (!variant && product.hasVariants) {
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

  return { submitCode, isLooking };
}
