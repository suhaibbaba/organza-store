// ── Barcode Queue — localStorage-backed "table" ───────────────────────────────
// Each saved barcode is a row in QUEUE_KEY array.

export interface SavedBarcode {
  id: string; // uuid-like
  value: string; // the actual barcode string (EAN-13, CODE-128, etc.)
  label: string; // display label (product + variant)
  productTitle: string;
  variantLabel: string; // option combo or sku
  sku: string;
  copies: number; // how many labels to print
  savedAt: number; // Date.now()
  printed: boolean; // toggled after print
}

const QUEUE_KEY = "organza_barcode_queue";

function read(): SavedBarcode[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: SavedBarcode[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function uuid(): string {
  return `bc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const barcodeQueue = {
  /** Get all saved barcodes, newest first */
  getAll(): SavedBarcode[] {
    return read().sort((a, b) => b.savedAt - a.savedAt);
  },

  /** Get only un-printed barcodes */
  getUnprinted(): SavedBarcode[] {
    return read()
      .filter((b) => !b.printed)
      .sort((a, b) => b.savedAt - a.savedAt);
  },

  /** Add a barcode to the queue. Returns the new item. */
  add(params: Omit<SavedBarcode, "id" | "savedAt" | "printed">): SavedBarcode {
    const items = read();
    const item: SavedBarcode = {
      ...params,
      id: uuid(),
      savedAt: Date.now(),
      printed: false,
    };
    items.push(item);
    write(items);
    return item;
  },

  /** Update copies count */
  setCopies(id: string, copies: number) {
    const items = read();
    const idx = items.findIndex((b) => b.id === id);
    if (idx !== -1) {
      items[idx].copies = Math.max(1, copies);
      write(items);
    }
  },

  /** Mark as printed */
  markPrinted(ids: string[]) {
    const set = new Set(ids);
    const items = read().map((b) =>
      set.has(b.id) ? { ...b, printed: true } : b,
    );
    write(items);
  },

  /** Remove a single barcode */
  remove(id: string) {
    write(read().filter((b) => b.id !== id));
  },

  /** Remove all printed */
  clearPrinted() {
    write(read().filter((b) => !b.printed));
  },

  /** Nuke everything */
  clearAll() {
    write([]);
  },

  /** Total un-printed count */
  unprintedCount(): number {
    return read().filter((b) => !b.printed).length;
  },
};
