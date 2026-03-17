// Preview table shown after CSV parsing — displays each row with validation status
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CSVRow } from "@/lib/bulk-operations-schemas";

interface RowError {
  row: number;
  errors: string[];
}

interface BulkImportPreviewTableProps {
  rows: CSVRow[];
  rowErrors: RowError[];
}

/** Maps 1-based CSV row number to its error list for O(1) lookup */
function buildErrorMap(rowErrors: RowError[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const re of rowErrors) {
    map.set(re.row, re.errors);
  }
  return map;
}

/** Scrollable preview table with green/red status per row */
export function BulkImportPreviewTable({ rows, rowErrors }: BulkImportPreviewTableProps) {
  // row index is 0-based; CSV row number is index+2 (header = row 1)
  const errorMap = buildErrorMap(rowErrors);

  return (
    <ScrollArea className="h-56 rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Tên</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Short code</TableHead>
            <TableHead className="w-10">OK</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => {
            const csvRow = idx + 2; // 1-based + skip header
            const errors = errorMap.get(csvRow);
            const isValid = !errors;
            return (
              <TableRow key={idx} className={isValid ? "" : "bg-destructive/5"}>
                <TableCell className="text-xs text-muted-foreground">{csvRow}</TableCell>
                <TableCell className="max-w-[120px] truncate text-sm">{row.name || "—"}</TableCell>
                <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                  {row.default_url || "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {row.custom_short_code ? (
                    <Badge variant="outline" className="text-xs">
                      {row.custom_short_code}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">tự sinh</span>
                  )}
                </TableCell>
                <TableCell>
                  {isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <span title={errors!.join("; ")}>
                      <XCircle className="h-4 w-4 text-destructive" />
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
