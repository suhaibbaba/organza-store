"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InventoryItem } from "@organza/shared/types/inventory";
import { clampQuantity } from "@organza/shared/constants/quantity";
import { ERROR_CODES } from "@organza/shared/constants/errors";
import { STOCK_ERROR_FLASH_MS, STOCK_SAVE_DEBOUNCE_MS, STOCK_SAVED_FLASH_MS } from "@/constants/inventory";
import { useAdjustStockMutation } from "@/hooks/use-inventory";
import { ApiError } from "@/lib/api/errors";
import type { StockEdit } from "@/types/inventory";

export interface StockEdits {
  /** Keyed by inventory row id. Absent means "nothing in flight, trust the server". */
  edits: Record<string, StockEdit>;
  /** A +/- press or a typed quantity. Moves the draft now, saves in a moment. */
  setStock: (item: InventoryItem, next: number) => void;
}

// The gap between pressing "+" and the shop's database agreeing.
//
// Each press used to be a request of its own, so taking a rail of shirts from
// 0 to 10 meant ten writes and ten audit entries reading 0→1, 1→2, 2→3 … —
// noise that buries the one fact anybody auditing wants ("somebody put ten
// shirts in"). Presses now move a local draft and the run settles into a
// single call once the finger stops.
//
// The draft is what the whole row renders from — the figure, the badge, the
// colour — so the screen keeps up with the finger while the network takes its
// time, and a background refetch landing mid-run cannot yank the number back.
export function useStockEdits(): StockEdits {
  const [edits, setEdits] = useState<Record<string, StockEdit>>({});
  const mutation = useAdjustStockMutation();

  // Timers, in-flight ids and the newest value per row. All refs: they change
  // on every press and must never re-render the list under the finger, and
  // nothing reads them while rendering.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const flashes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlight = useRef(new Set<string>());
  const latest = useRef(new Map<string, { item: InventoryItem; value: number; baseline: number }>());

  useEffect(() => {
    const pendingTimers = timers.current;
    const pendingFlashes = flashes.current;
    return () => {
      for (const timer of pendingTimers.values()) clearTimeout(timer);
      for (const timer of pendingFlashes.values()) clearTimeout(timer);
    };
  }, []);

  const clearEdit = useCallback((id: string) => {
    setEdits((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const flashThenClear = useCallback(
    (id: string, ms: number) => {
      const existing = flashes.current.get(id);
      if (existing) clearTimeout(existing);
      flashes.current.set(
        id,
        setTimeout(() => {
          flashes.current.delete(id);
          clearEdit(id);
        }, ms)
      );
    },
    [clearEdit]
  );

  const flush = useCallback(
    async (id: string) => {
      timers.current.delete(id);
      const pending = latest.current.get(id);
      if (!pending) return;

      // Another call for this row is already on the wire. Starting a second
      // would let the two land out of order and leave the server on whichever
      // finished last rather than on what the user actually dialled — so wait
      // for it and re-arm instead.
      if (inFlight.current.has(id)) {
        timers.current.set(id, setTimeout(() => void flush(id), STOCK_SAVE_DEBOUNCE_MS));
        return;
      }

      // Pressed up and back down again: nothing to tell the server, and no
      // audit entry deserves to be written for a round trip to nowhere.
      if (pending.value === pending.baseline) {
        latest.current.delete(id);
        clearEdit(id);
        return;
      }

      inFlight.current.add(id);
      setEdits((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], status: "saving" } } : prev));

      try {
        await mutation.mutateAsync({ item: pending.item, stock: pending.value });
        latest.current.delete(id);
        setEdits((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], status: "saved" } } : prev));
        // Held rather than cleared at once: the invalidation this triggers has
        // to come back before the row can go back to reading the server, or
        // the figure would flick to the old one for a frame.
        flashThenClear(id, STOCK_SAVED_FLASH_MS);
      } catch (error) {
        // Put back what the shop actually holds. A quantity that looks saved
        // and isn't is the one outcome worth being loud about.
        const baseline = pending.baseline;
        latest.current.delete(id);
        setEdits((prev) => ({
          ...prev,
          [id]: {
            value: baseline,
            baseline,
            status: "error",
            errorCode: error instanceof ApiError ? error.code : ERROR_CODES.INTERNAL,
          },
        }));
        flashThenClear(id, STOCK_ERROR_FLASH_MS);
      } finally {
        inFlight.current.delete(id);
      }
    },
    [clearEdit, flashThenClear, mutation]
  );

  const setStock = useCallback(
    (item: InventoryItem, next: number) => {
      const id = item.id;
      const value = clampQuantity(next);

      // Where the server was before this run started. Kept across presses so
      // ten of them still produce one entry reading 0 → 10, and so a failure
      // anywhere in the run reverts to where the run began.
      const baseline = latest.current.get(id)?.baseline ?? item.stock;
      latest.current.set(id, { item, value, baseline });

      const flash = flashes.current.get(id);
      if (flash) {
        clearTimeout(flash);
        flashes.current.delete(id);
      }

      setEdits((prev) => ({ ...prev, [id]: { value, baseline, status: "pending" } }));

      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.set(id, setTimeout(() => void flush(id), STOCK_SAVE_DEBOUNCE_MS));
    },
    [flush]
  );

  return { edits, setStock };
}
