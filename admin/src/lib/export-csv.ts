import { CSV_BOM, EXPORT_FILE_PREFIX } from "@/constants/dashboard";

// Built in the browser from what the API already sent, so a role without cost exports none.

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return CSV_BOM + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

// Revoked because a POS tablet goes days without a reload.
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

// Period plus date, so two exports never overwrite each other.
export function exportFilename(periodKey: string, date: Date): string {
  const day = date.toISOString().slice(0, 10);
  return `${EXPORT_FILE_PREFIX}-${periodKey}-${day}.csv`;
}
