"use client";

import { useState } from "react";
import type { InventoryItem } from "@store/shared/types/inventory";
import { clampQuantity } from "@store/shared/constants/quantity";
import { useAdjustStockMutation } from "@/hooks/use-inventory";
import type { StockDraft } from "@/types/inventory";

// Quantities are staged and written together by the page's Save: one audited change per row, never per press.
export function useStockDrafts() {
  const [drafts, setDrafts] = useState<Record<string, StockDraft>>({});
  const [saving, setSaving] = useState(false);
  const mutation = useAdjustStockMutation();

  function setStock(item: InventoryItem, next: number) {
    const value = clampQuantity(next);
    setDrafts((prev) => {
      const updated = { ...prev };
      if (value === item.stock) delete updated[item.id];
      else updated[item.id] = { item, value, failed: false };
      return updated;
    });
  }

  async function save() {
    const pending = Object.values(drafts);
    setSaving(true);
    const results = await Promise.allSettled(
      pending.map((draft) => mutation.mutateAsync({ item: draft.item, stock: draft.value }))
    );
    const failed: Record<string, StockDraft> = {};
    results.forEach((result, index) => {
      const draft = pending[index];
      if (result.status === "rejected" && draft) failed[draft.item.id] = { ...draft, failed: true };
    });
    setDrafts(failed);
    setSaving(false);
  }

  const list = Object.values(drafts);
  return {
    drafts,
    setStock,
    save,
    discard: () => setDrafts({}),
    saving,
    count: list.length,
    failedCount: list.filter((draft) => draft.failed).length,
  };
}
