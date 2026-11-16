import { tokenStore } from '@web/shared/lib/token-store';
import { drawerKick, initialize, receiptJob } from '@web/shared/printing/escpos';
import { printSettings, receiptPrinter } from '@web/shared/printing/printer';

/**
 * The bridge to the Windows (later Linux) shell in apps/desktop. The same web build runs in
 * both; inside Tauri this installs the OS secure store for the refresh token and a printer that
 * sends ESC/POS bytes straight to the receipt printer. Commands are defined in
 * apps/desktop/src-tauri/src/lib.rs; keep the names in step.
 */

interface TauriInternals {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

export const isDesktop = (): boolean =>
  typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const tauri = window.__TAURI_INTERNALS__;
  if (!tauri) return Promise.reject(new Error(`Not in the desktop app: ${cmd}`));
  return tauri.invoke<T>(cmd, args);
}

const REFRESH_KEY = 'refresh-token';

export interface AppInfo {
  version: string;
  os: string;
}
export interface UpdateInfo {
  version: string;
  notes: string | null;
}

export const desktop = {
  info: () => invoke<AppInfo>('app_info'),
  checkForUpdate: () => invoke<UpdateInfo | null>('update_check'),
  /** Downloads, verifies the signature, installs and restarts. */
  installUpdate: () => invoke<void>('update_install'),
};

async function sendRaw(bytes: Uint8Array) {
  const { printer } = printSettings.get();
  if (!printer) throw new Error('PRINTER_NOT_SET');
  await invoke<void>('print_raw', { printer, data: Array.from(bytes) });
}

/** Called once before the app renders. Does nothing in a browser. */
export function installDesktop(): void {
  if (!isDesktop()) return;
  document.documentElement.dataset.desktop = 'true';

  tokenStore.install({
    kind: 'secure-store',
    load: () => invoke<string | null>('secret_get', { key: REFRESH_KEY }),
    save: (token) => invoke<void>('secret_set', { key: REFRESH_KEY, value: token }),
    clear: () => invoke<void>('secret_delete', { key: REFRESH_KEY }),
  });

  receiptPrinter.install({
    kind: 'escpos',
    printImage: async (image, { openDrawer }) => {
      const { drawerPin } = printSettings.get();
      await sendRaw(receiptJob(image, { openDrawer, drawerPin }));
    },
    openDrawer: async () => {
      const { drawerPin } = printSettings.get();
      await sendRaw(Uint8Array.from([...initialize(), ...drawerKick(drawerPin)]));
    },
    listPrinters: () => invoke<string[]>('list_printers'),
  });
}
