import { useRef, useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { parseCSV, validateCSVRows, groupRowsIntoLinks } from "@/lib/bulk-operations-utils";
import type { CSVRow } from "@/lib/bulk-operations-schemas";
import { useBulkCreateLinks } from "@/hooks/use-link-mutations";
import { BulkImportPreviewTable } from "@/components/bulk-import-preview-table";
import { useToast } from "@/hooks/use-toast";

type ImportPhase = "idle" | "preview" | "importing" | "done";
const MAX_CSV_FILE_SIZE_BYTES = 1024 * 1024;
const MAX_CSV_ROWS = 500;
interface RowError { row: number; errors: string[] }
interface ImportSummary { succeeded: number; failed: number; errors: Array<{ name: string; error: string }> }

export function BulkImportDialog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [validRows, setValidRows] = useState<CSVRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const bulkCreate = useBulkCreateLinks();

  const resetState = () => {
    setPhase("idle");
    setRows([]);
    setRowErrors([]);
    setValidRows([]);
    setProgress(0);
    setSummary(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetState();
  };

  const processFile = useCallback((file: File) => {
    if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
      toast({
        title: "File CSV quá lớn",
        description: "Vui lòng chọn file nhỏ hơn hoặc bằng 1 MB.",
        variant: "destructive",
      });
      return;
    }
    if (!file.name.endsWith(".csv")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rowCount = Math.max(
        text.split(/\r?\n/).filter((line) => line.trim() !== "").length - 1,
        0
      );
      if (rowCount > MAX_CSV_ROWS) {
        toast({
          title: "CSV có quá nhiều dòng",
          description: "Tối đa 500 dòng dữ liệu để tránh treo trình duyệt.",
          variant: "destructive",
        });
        return;
      }
      const parsed = parseCSV(text);
      const { valid, errors } = validateCSVRows(parsed);
      setRows(parsed);
      setRowErrors(errors);
      setValidRows(valid);
      setPhase("preview");
    };
    reader.readAsText(file, "utf-8");
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (!user || validRows.length === 0) return;
    const grouped = groupRowsIntoLinks(validRows);
    setPhase("importing");
    setProgress(0);

    const result = await bulkCreate.mutateAsync({
      links: grouped,
      userId: user.id,
      onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
    });

    setSummary(result);
    setPhase("done");
  };

  const validCount = validRows.length > 0 ? groupRowsIntoLinks(validRows).length : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-1" />
          Nhập CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhập link từ CSV</DialogTitle>
        </DialogHeader>

        {/* ── Idle: drop zone ── */}
        {phase === "idle" && (
          <div
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 gap-3 transition-colors cursor-pointer
              ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Kéo thả file CSV hoặc nhấn để chọn</p>
            <p className="text-xs text-muted-foreground">
              Cột: name, default_url, custom_short_code, expires_at, geo_country_code, geo_target_url, geo_bypass_url
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* ── Preview: table + summary ── */}
        {phase === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{rows.length} dòng — <span className="text-green-600 font-medium">{validRows.length} hợp lệ</span>{rowErrors.length > 0 && <span className="text-destructive ml-1">· {rowErrors.length} lỗi</span>}</span>
              <Button variant="ghost" size="sm" onClick={resetState}>Chọn file khác</Button>
            </div>

            <BulkImportPreviewTable rows={rows} rowErrors={rowErrors} />

            {rowErrors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive space-y-1 max-h-24 overflow-y-auto">
                {rowErrors.map((re) => (
                  <div key={re.row}><span className="font-medium">Dòng {re.row}:</span> {re.errors.join("; ")}</div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Hủy</Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Nhập {validCount} link
              </Button>
            </div>
          </div>
        )}

        {/* ── Importing: progress bar ── */}
        {phase === "importing" && (
          <div className="space-y-4 py-6">
            <p className="text-sm text-center text-muted-foreground">Đang nhập link…</p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* ── Done: results summary ── */}
        {phase === "done" && summary && (
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-card border border-border p-4 text-sm space-y-1">
              <p className="text-green-600 font-medium">✓ {summary.succeeded} link đã nhập thành công</p>
              {summary.failed > 0 && (
                <p className="text-destructive">✗ {summary.failed} link thất bại</p>
              )}
            </div>
            {summary.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive space-y-1 max-h-28 overflow-y-auto">
                {summary.errors.map((e, i) => (
                  <div key={i}><span className="font-medium">{e.name}:</span> {e.error}</div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetState}>Nhập thêm</Button>
              <Button onClick={() => handleOpenChange(false)}>Đóng</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
