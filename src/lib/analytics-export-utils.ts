// Analytics export utilities — CSV generation and PDF print helpers
import { LinkAnalyticsDetailRow } from "@/lib/db";
import { COUNTRIES } from "@/lib/types";

export function sanitizeCSVValue(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCSVField(value: string): string {
  const safeValue = sanitizeCSVValue(value);
  if (/[",\n\r]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

/** Build a CSV string from analytics detail data */
export function generateAnalyticsCSV(analytics: LinkAnalyticsDetailRow, linkName: string): string {
  const rows: string[] = [];

  // Header metadata
  rows.push(`# Analytics export for: ${escapeCSVField(linkName)}`);
  rows.push(`# Generated: ${new Date().toLocaleString("vi-VN")}`);
  rows.push(`# Total clicks: ${analytics.total_clicks}`);
  rows.push("");

  // Clicks by day section
  rows.push("=== Clicks theo ngày ===");
  rows.push("Ngày,Clicks");
  for (const day of analytics.clicks_by_day) {
    rows.push(`${day.date},${day.clicks}`);
  }
  rows.push("");

  // Country breakdown section
  rows.push("=== Theo quốc gia ===");
  rows.push("Mã quốc gia,Tên quốc gia,Clicks");
  for (const entry of analytics.country_breakdown) {
    const country = COUNTRIES.find((c) => c.code === entry.country_code);
    const name = country ? country.name : entry.country_code;
    rows.push(
      `${escapeCSVField(entry.country_code)},${escapeCSVField(name)},${entry.clicks}`
    );
  }
  rows.push("");

  // Referer breakdown section
  rows.push("=== Nguồn truy cập ===");
  rows.push("Nguồn,Clicks");
  for (const entry of analytics.referer_breakdown) {
    rows.push(`${escapeCSVField(entry.referer || "direct")},${entry.clicks}`);
  }

  return rows.join("\n");
}

/** Trigger browser download of CSV content */
export function triggerCSVDownload(csv: string, filename: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Trigger browser print dialog for PDF export */
export function triggerPrintExport(): void {
  window.print();
}
