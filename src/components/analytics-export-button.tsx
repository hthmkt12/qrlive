// Analytics export button — CSV download + PDF print via browser
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkAnalyticsDetailRow } from "@/lib/db";
import {
  generateAnalyticsCSV,
  triggerCSVDownload,
  triggerPrintExport,
} from "@/lib/analytics-export-utils";

interface AnalyticsExportButtonProps {
  analytics: LinkAnalyticsDetailRow;
  linkName: string;
  shortCode: string;
}

export function AnalyticsExportButton({ analytics, linkName, shortCode }: AnalyticsExportButtonProps) {
  function handleCSVExport() {
    const csv = generateAnalyticsCSV(analytics, linkName);
    const date = new Date().toISOString().split("T")[0];
    triggerCSVDownload(csv, `analytics-${shortCode}-${date}.csv`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Xuất dữ liệu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCSVExport}>
          Tải xuống CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={triggerPrintExport}>
          In PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
