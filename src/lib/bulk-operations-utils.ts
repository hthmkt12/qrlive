// Utility functions for CSV bulk import/export of QR links
import { csvRowSchema, type CSVRow, type GroupedLink } from "./bulk-operations-schemas";
import type { QRLinkRow } from "./db/models";

const CSV_HEADERS = ["name", "default_url", "custom_short_code", "expires_at", "geo_country_code", "geo_target_url", "geo_bypass_url"] as const;

function parseField(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1).replace(/""/g, '"');
  return trimmed;
}

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
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

function splitCSVRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '"') {
      if (inQuotes && text[index + 1] === '"') {
        current += '""';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[index + 1] === "\n") index += 1;
      if (current.trim() !== "") records.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim() !== "") records.push(current);
  return records;
}

export function countCSVRows(text: string) {
  return Math.max(splitCSVRecords(text).length - 1, 0);
}

export function parseCSV(text: string): CSVRow[] {
  const lines = splitCSVRecords(text);
  if (lines.length < 2) return [];
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

export function validateCSVRows(rows: CSVRow[]): ValidationResult {
  const valid: CSVRow[] = [];
  const errors: Array<{ row: number; errors: string[] }> = [];

  rows.forEach((row, idx) => {
    const result = csvRowSchema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({
        row: idx + 2,
        errors: result.error.issues.map((i) => i.message),
      });
    }
  });

  return { valid, errors };
}

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
        country: row.geo_country_code,
        targetUrl: row.geo_target_url,
        bypassUrl: row.geo_bypass_url ?? "",
      });
    }
  }

  return Array.from(map.values());
}

function sanitizeCSVValue(value: string): string {
  const trimmedPrefix = value.replace(/^[ \t\r\n]+/, "");
  return /^[\t\r\n]/.test(value) || /^[=+\-@]/.test(trimmedPrefix) ? `'${value}` : value;
}

function escapeCSVField(value: string): string {
  const safeValue = sanitizeCSVValue(value);
  if (/[",\n\r]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

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
