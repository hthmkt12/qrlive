import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkImportDialog } from "@/components/bulk-import-dialog";

const { mockToast, mockBulkCreate } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockBulkCreate: vi.fn(),
}));

type MockCsvFile = File & { __content?: string };

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/hooks/use-link-mutations", () => ({
  useBulkCreateLinks: () => ({ mutateAsync: mockBulkCreate }),
}));

vi.mock("@/components/bulk-import-preview-table", () => ({
  BulkImportPreviewTable: () => <div data-testid="bulk-import-preview-table" />,
}));

class MockFileReader {
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  readAsText(file: Blob) {
    const result = (file as MockCsvFile).__content ?? "";
    this.onload?.({ target: { result } } as ProgressEvent<FileReader>);
  }
}

function buildCsv(rows: number) {
  const data = ["name,default_url"];
  for (let index = 0; index < rows; index += 1) data.push(`Link ${index},https://example.com/${index}`);
  return data.join("\n");
}

function createCsvFile(content = "") {
  const file = new File([""], "links.csv", { type: "text/csv" }) as MockCsvFile;
  file.__content = content;
  return file;
}

async function uploadCsv(file: File) {
  const user = userEvent.setup();
  render(<BulkImportDialog />);
  await user.click(screen.getByRole("button", { name: /Nhập CSV/i }));
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("BulkImportDialog limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("FileReader", MockFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a Vietnamese toast when the CSV exceeds 1MB", async () => {
    const file = createCsvFile();
    Object.defineProperty(file, "size", { value: 1024 * 1024 + 1 });
    await uploadCsv(file);

    expect(mockToast).toHaveBeenCalledWith({
      title: "File CSV quá lớn",
      description: "Vui lòng chọn file nhỏ hơn hoặc bằng 1 MB.",
      variant: "destructive",
    });
  });

  it("shows a Vietnamese toast when the CSV has more than 500 rows", async () => {
    const file = createCsvFile(buildCsv(501));
    await uploadCsv(file);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "CSV có quá nhiều dòng",
        description: "Tối đa 500 dòng dữ liệu để tránh treo trình duyệt.",
        variant: "destructive",
      });
    });
  });
});
