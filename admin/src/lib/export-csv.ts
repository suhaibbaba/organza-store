import { CSV_BOM, EXPORT_FILE_PREFIX } from "@/constants/dashboard";

// Downloading the figures on screen as a spreadsheet.
//
// CSV rather than a real .xlsx: Excel opens it natively, it needs no library
// (the deployment rules keep third-party dependencies down), and it survives
// being mailed to an accountant. Built entirely in the browser from data the
// caller already has — no endpoint, so nothing can be exported that the API
// didn't already send, and a role without cost/profit exports a file without
// those rows because they were never in the payload.

// Anything with a comma, a quote or a newline has to be quoted, and quotes
// inside are doubled. Arabic and Hebrew need no escaping — only the BOM below.
function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return CSV_BOM + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

// Hands the file to the browser. Revoking the object URL afterwards matters
// on a POS tablet that is never reloaded for days.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// organza-this-month-2026-08-06.csv — the period and the day it was taken,
// so two exports never overwrite each other in the Downloads folder.
export function exportFilename(periodKey: string, date: Date): string {
  const day = date.toISOString().slice(0, 10);
  return `${EXPORT_FILE_PREFIX}-${periodKey}-${day}.csv`;
}
