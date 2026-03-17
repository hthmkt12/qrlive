// Utility functions for CSV bulk import/export of QR links
import { csvRowSchema, type CSVRow, type GroupedLink } from "./bulk-operations-schemas";
import type { QRLinkRow } from "./db/models";

// CSV header columns in order
const CSV_HEADERS = [
  "name",
  "default_url",
  "custom_short_code",
  "expires_at",
  "geo_country_code",
  "geo_target_url",
  "geo_bypass_url",
] as const;

/** Parse a single CSV field — handles quoted fields containing commas/newlines */
function parseField(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    // Remove surrounding quotes and unescape doubled quotes
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

/** Split a CSV line into fields — respects quoted fields with embedded commas */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Parse raw CSV text into an array of CSVRow objects (skips header row) */
export function parseCSV(text: string): CSVRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  // First line must be the header
  const headers = splitCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((header, idx) => {
      raw[header] = parseField(values[idx] ?? "");
    });
    return raw as CSVRow;
  });
}

export interface ValidationResult {
  valid: CSVRow[];
  errors: Array<{ row: number; errors: string[] }>;
}

/** Validate parsed CSV rows against csvRowSchema; returns valid rows and per-row errors */
export function validateCSVRows(rows: CSVRow[]): ValidationResult {
  const valid: CSVRow[] = [];
  const errors: Array<{ row: number; errors: string[] }> = [];

  rows.forEach((row, idx) => {
    const result = csvRowSchema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({
        row: idx + 2, // +2: 1-based + skip header
        errors: result.error.issues.map((i) => i.message),
      });
    }
  });

  return { valid, errors };
}

/** Group CSV rows by name+custom_short_code to consolidate geo routes per link */
export function groupRowsIntoLinks(rows: CSVRow[]): GroupedLink[] {
  const map = new Map<string, GroupedLink>();

  for (const row of rows) {
    const key = `${row.name}||${row.custom_short_code ?? ""}`;
    if (!map.has(key)) {
      map.set(key, {
        name: row.name,
        default_url: row.default_url,
        custom_short_code: row.custom_short_code ?? "",
        expires_at: row.expires_at ?? "",
        geo_routes: [],
      });
    }
    const link = map.get(key)!;
    if (row.geo_country_code && row.geo_target_url) {
      link.geo_routes.push({
        countryCode: row.geo_country_code,
        country: row.geo_country_code, // use code as country name for CSV import
        targetUrl: row.geo_target_url,
        bypassUrl: row.geo_bypass_url ?? "",
      });
    }
  }

  return Array.from(map.values());
}

/** Escape a CSV field value — wraps in quotes if it contains commas, quotes, or newlines */
function sanitizeCSVValue(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCSVField(value: string): string {
  const safeValue = sanitizeCSVValue(value);
  if (/[",\n\r]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

/**
 * Generate CSV text from an array of QRLinkRow objects.
 * Links with multiple geo routes produce multiple rows (same name/short_code).
 */
export function generateLinksCSV(links: QRLinkRow[]): string {
  const rows: string[] = [CSV_HEADERS.join(",")];

  for (const link of links) {
    const base = [
      escapeCSVField(link.name),
      escapeCSVField(link.default_url),
      escapeCSVField(link.short_code),
      escapeCSVField(link.expires_at ?? ""),
    ];

    if (link.geo_routes && link.geo_routes.length > 0) {
      for (const route of link.geo_routes) {
        rows.push(
          [
            ...base,
            escapeCSVField(route.country_code),
            escapeCSVField(route.target_url),
            escapeCSVField(route.bypass_url ?? ""),
          ].join(",")
        );
      }
    } else {
      rows.push([...base, "", "", ""].join(","));
    }
  }

  return rows.join("\n");
}

/** Trigger a browser download of CSV text as a .csv file */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
