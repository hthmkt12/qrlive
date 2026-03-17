import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyticsExportButton } from "@/components/analytics-export-button";
import type { LinkAnalyticsDetailRow } from "@/lib/db";

const {
  mockGenerateAnalyticsCSV,
  mockTriggerCSVDownload,
  mockTriggerPrintExport,
} = vi.hoisted(() => ({
  mockGenerateAnalyticsCSV: vi.fn(() => "csv-content"),
  mockTriggerCSVDownload: vi.fn(),
  mockTriggerPrintExport: vi.fn(),
}));

vi.mock("@/lib/analytics-export-utils", () => ({
  generateAnalyticsCSV: mockGenerateAnalyticsCSV,
  triggerCSVDownload: mockTriggerCSVDownload,
  triggerPrintExport: mockTriggerPrintExport,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("lucide-react", () => ({
  Download: () => <span>download</span>,
}));

const analytics: LinkAnalyticsDetailRow = {
  link_id: "link-1",
  total_clicks: 12,
  today_clicks: 3,
  countries_count: 2,
  clicks_by_day: [],
  country_breakdown: [],
  referer_breakdown: [],
};

describe("AnalyticsExportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAnalyticsCSV.mockReturnValue("csv-content");
  });

  it("generates and downloads CSV with the optional referer country label", async () => {
    const user = userEvent.setup();
    render(
      <AnalyticsExportButton
        analytics={analytics}
        linkName="Chiến dịch xuân"
        shortCode="SPRING1"
        refererCountryLabel="🇻🇳 Việt Nam"
      />
    );

    await user.click(screen.getByRole("button", { name: /Tải xuống CSV/i }));

    expect(mockGenerateAnalyticsCSV).toHaveBeenCalledWith(analytics, "Chiến dịch xuân", "🇻🇳 Việt Nam");
    expect(mockTriggerCSVDownload).toHaveBeenCalledWith("csv-content", expect.stringMatching(/^analytics-SPRING1-\d{4}-\d{2}-\d{2}\.csv$/));
  });

  it("triggers print export for PDF action", async () => {
    const user = userEvent.setup();
    render(
      <AnalyticsExportButton
        analytics={analytics}
        linkName="Chiến dịch xuân"
        shortCode="SPRING1"
      />
    );

    await user.click(screen.getByRole("button", { name: /In PDF/i }));

    expect(mockTriggerPrintExport).toHaveBeenCalledOnce();
  });
});
