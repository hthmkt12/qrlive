// Button that exports all current links to a downloadable CSV file
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QRLinkRow } from "@/lib/db/models";
import { generateLinksCSV, downloadCSV } from "@/lib/bulk-operations-utils";

interface BulkExportButtonProps {
  links: QRLinkRow[];
  disabled?: boolean;
}

/** Generates and downloads a CSV of all provided links with their geo routes */
export function BulkExportButton({ links, disabled }: BulkExportButtonProps) {
  const handleExport = () => {
    if (links.length === 0) return;
    const csv = generateLinksCSV(links);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `qrlive-links-${date}.csv`);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={disabled || links.length === 0}
      title="Xuất tất cả link ra file CSV"
    >
      <Download className="h-4 w-4 mr-1" />
      Xuất CSV
    </Button>
  );
}
