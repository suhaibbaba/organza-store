import { safeStorage } from '@web/shared/lib/safe-storage';
import type { PaperWidth } from './escpos';

/**
 * How this device prints receipts. The web build prints through the browser's dialog; the
 * desktop shell installs a printer that sends ESC/POS straight to the receipt printer and can
 * open the cash drawer. Screens only talk to this interface (proposal B: printing behind an
 * interface so a Linux till needs no rework).
 */
export interface ReceiptPrinter {
  readonly kind: 'browser' | 'escpos';
  /** Prints a raster image already painted for the paper width; false when it could not. */
  printImage(image: ImageData, options: { openDrawer?: boolean }): Promise<void>;
  openDrawer(): Promise<void>;
  listPrinters(): Promise<string[]>;
}

export interface DevicePrintSettings {
  /** The printer's name in the system, or `tcp://host:port` for a network printer. */
  printer: string | null;
  paper: PaperWidth;
  /** Print the receipt as soon as a sale is saved, without the preview. */
  autoPrint: boolean;
  /** Open the drawer when a sale takes or gives back cash. */
  drawerOnCash: boolean;
  drawerPin: 0 | 1;
}

const KEY = 'organza.device.print';
export const DEFAULT_PRINT_SETTINGS: DevicePrintSettings = {
  printer: null,
  paper: 80,
  autoPrint: false,
  drawerOnCash: true,
  drawerPin: 0,
};

/** Per-device settings: which printer this PC uses is not a shop-wide setting. */
export const printSettings = {
  get(): DevicePrintSettings {
    try {
      const raw = safeStorage.get(KEY);
      return raw
        ? { ...DEFAULT_PRINT_SETTINGS, ...(JSON.parse(raw) as object) }
        : DEFAULT_PRINT_SETTINGS;
    } catch {
      return DEFAULT_PRINT_SETTINGS;
    }
  },
  set(value: DevicePrintSettings) {
    safeStorage.set(KEY, JSON.stringify(value));
  },
};

const browserPrinter: ReceiptPrinter = {
  kind: 'browser',
  printImage: () => Promise.reject(new Error('Browser printing goes through printPortal')),
  openDrawer: () => Promise.resolve(),
  listPrinters: () => Promise.resolve([]),
};

let current: ReceiptPrinter = browserPrinter;

export const receiptPrinter = {
  get: (): ReceiptPrinter => current,
  install: (printer: ReceiptPrinter) => {
    current = printer;
  },
};
