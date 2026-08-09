"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InventoryItem } from "@shared/types/inventory";
import { subscribeToManualRefresh } from "@/lib/manual-refresh";
import type { InventoryRow, StockEdit } from "@/types/inventory";

interface Pin {
  /** Where the row sat when the user first touched it. */
  index: number;
  /** Its data at that moment, so it can still be drawn once the server stops returning it. */
  item: InventoryItem;
}

export interface InventoryRows {
  rows: InventoryRow[];
  /** Remember where a row is, because the user is about to change it. */
  pin: (item: InventoryItem) => void;
  /** Let the held rows go: the user asked for the list again, or changed what they asked for. */
  release: () => void;
  /** How many rows are only still on screen because they were pinned. */
  outsideFilterCount: number;
}

// Keeps the list still while somebody is working down it.
//
// The default sort is by stock ascending and the usual filter is "low stock
// only", so the list is sorted and filtered by the very number being edited.
// Left alone, raising a sold-out item from 0 to 1 made its row jump down the
// page or vanish outright the instant it saved — the user lost their place,
// and could not tell whether the change had even gone through.
//
// So a row the user has touched is pinned: it keeps the position it had when
// they reached for it, and it stays on screen even once the server stops
// returning it, marked as no longer matching. Untouched rows are still drawn
// from whatever the last read said — their own numbers haven't moved, so they
// don't either.
//
// Pins are let go on the two events that mean "show me the list as it is now":
// changing the filter, and asking for a refresh. Never on a refetch the app
// decided to do by itself, and never on the refetch the save itself triggers —
// that one is precisely the case this exists for.
export function useInventoryRows(items: InventoryItem[], edits: Record<string, StockEdit>): InventoryRows {
  const [pins, setPins] = useState<Map<string, Pin>>(() => new Map());

  const release = useCallback(() => {
    setPins((prev) => (prev.size === 0 ? prev : new Map()));
  }, []);

  // Pull-to-refresh lives in the app shell, several levels up, and is the
  // other way a user says "show me the list as it is now".
  useEffect(() => subscribeToManualRefresh(release), [release]);

  const pin = useCallback(
    (item: InventoryItem) => {
      setPins((prev) => {
        if (prev.has(item.id)) return prev;
        // The index that matters is where the row sits ON SCREEN, which is
        // not where the server put it once other rows are already pinned.
        // Taking the server's index instead let a second edited row jump to
        // the top, past the first one being held there.
        const displayed = arrange(items, prev);
        const index = displayed.findIndex((entry) => entry.item.id === item.id);
        const next = new Map(prev);
        next.set(item.id, { index: index === -1 ? displayed.length : index, item });
        return next;
      });
    },
    [items]
  );

  const rows = useMemo<InventoryRow[]>(
    () => arrange(items, pins).map((entry) => toRow(entry.item, edits, entry.isOutsideFilter)),
    [items, pins, edits]
  );

  return {
    rows,
    pin,
    release,
    outsideFilterCount: rows.reduce((count, row) => count + (row.isOutsideFilter ? 1 : 0), 0),
  };
}

// The order the list is drawn in: whatever the last read returned, with each
// pinned row put back at the position it held when the user reached for it.
// Pure, so `pin` can ask the same question the render will answer.
function arrange(
  items: InventoryItem[],
  pins: Map<string, Pin>
): { item: InventoryItem; isOutsideFilter: boolean }[] {
  const byId = new Map(items.map((item) => [item.id, item]));

  const out = items
    .filter((item) => !pins.has(item.id))
    .map((item) => ({ item, isOutsideFilter: false }));

  // Lowest index first, so each insertion lands before the ones after it and
  // two pinned rows keep their order relative to each other.
  for (const [id, pin] of [...pins.entries()].sort((a, b) => a[1].index - b[1].index)) {
    const fresh = byId.get(id);
    out.splice(Math.min(pin.index, out.length), 0, {
      item: fresh ?? pin.item,
      isOutsideFilter: fresh === undefined,
    });
  }

  return out;
}

function toRow(item: InventoryItem, edits: Record<string, StockEdit>, isOutsideFilter: boolean): InventoryRow {
  const edit = edits[item.id] ?? null;
  return {
    item,
    // The draft wins while there is one: it is what the user just asked for,
    // and it is what the badge and the colour beside it have to agree with.
    stock: edit ? edit.value : item.stock,
    edit,
    isOutsideFilter,
  };
}
