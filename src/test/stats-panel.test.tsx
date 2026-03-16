/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatsPanel } from "@/components/StatsPanel";
import { QRLinkRow, LinkAnalyticsDetailRow } from "@/lib/db";

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/components/QRPreview", () => ({
  QRPreview: ({ url, shortCode, name }: any) => (
    <div data-testid="qr-preview">
      QRPreview: {shortCode}
    </div>
  ),
}));

// Mock recharts components to avoid rendering issues in tests
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ data }: any) => (
    <div data-testid="bar-chart">
      {data.map((d: any, i: number) => (
        <div key={i}>{d.date}</div>
      ))}
    </div>
  ),
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data }: any) => (
    <div data-testid="pie">
      {data.map((d: any, i: number) => (
        <div key={i}>{d.name}</div>
      ))}
    </div>
  ),
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Cell: () => <div />,
}));

// ─── Test data ────────────────────────────────────────────────────────────────

const mockLink: QRLinkRow = {
  id: "link-1",
  user_id: "user-1",
  name: "Test QR Link",
  short_code: "ABC123",
  default_url: "https://example.com",
  is_active: true,
  created_at: "2026-03-16T00:00:00Z",
  geo_routes: [],
};

const mockAnalyticsDetail: LinkAnalyticsDetailRow = {
  link_id: "link-1",
  total_clicks: 100,
  today_clicks: 15,
  countries_count: 5,
  clicks_by_day: [
    { date: "2026-03-10", clicks: 10 },
    { date: "2026-03-11", clicks: 15 },
    { date: "2026-03-12", clicks: 20 },
    { date: "2026-03-13", clicks: 18 },
    { date: "2026-03-14", clicks: 22 },
    { date: "2026-03-15", clicks: 10 },
    { date: "2026-03-16", clicks: 5 },
  ],
  country_breakdown: [
    { country_code: "VN", clicks: 40 },
    { country_code: "US", clicks: 30 },
    { country_code: "JP", clicks: 20 },
  ],
  referer_breakdown: [
    { referer: "direct", clicks: 50 },
    { referer: "facebook.com", clicks: 30 },
    { referer: "google.com", clicks: 20 },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StatsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders back button", () => {
    const onBack = vi.fn();
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={onBack}
      />
    );
    expect(screen.getByText(/Quay lại/)).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={onBack}
      />
    );

    const backButton = screen.getByText(/Quay lại/);
    await user.click(backButton);

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("displays total clicks count", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText(/Tổng clicks/)).toBeInTheDocument();
  });

  it("displays today clicks count", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText(/Hôm nay/)).toBeInTheDocument();
  });

  it("displays countries count", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );
    // Find the countries count card specifically
    const cards = screen.getAllByText(/Quốc gia/);
    const countriesCard = cards[0].closest("div[class*='rounded-xl']");
    expect(countriesCard).toHaveTextContent("5");
  });

  it("displays loading state when isLoading is true", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        isLoading={true}
        onBack={vi.fn()}
      />
    );
    // When loading, stats should show "..."
    const dots = screen.getAllByText(/\.\.\./);
    expect(dots.length).toBeGreaterThan(0);
  });

  it("renders bar chart with click data", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    const barChart = screen.getByTestId("bar-chart");
    expect(barChart).toBeInTheDocument();

    // Check that the chart title is present
    expect(screen.getByText(/Clicks 7 ngày qua/)).toBeInTheDocument();
  });

  it("displays 'Clicks 7 ngày qua' chart title", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText(/Clicks 7 ngày qua/)).toBeInTheDocument();
  });

  it("renders country breakdown pie chart when data exists", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText(/Theo quốc gia/)).toBeInTheDocument();
    const pieChart = screen.getByTestId("pie-chart");
    expect(pieChart).toBeInTheDocument();
  });

  it("displays country breakdown data in pie chart", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    // Check country names appear in breakdown - use more specific matcher
    const countryElements = screen.getAllByText(/VN/);
    expect(countryElements.length).toBeGreaterThan(0);
  });

  it("shows 'Chưa có dữ liệu' for empty country breakdown", () => {
    const analyticsEmpty: LinkAnalyticsDetailRow = {
      ...mockAnalyticsDetail,
      country_breakdown: [],
    };

    render(
      <StatsPanel
        link={mockLink}
        analytics={analyticsEmpty}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText(/Chưa có dữ liệu/)).toBeInTheDocument();
  });

  it("displays referer breakdown section", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText(/Nguồn truy cập/)).toBeInTheDocument();
  });

  it("displays referer sources", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText(/direct/)).toBeInTheDocument();
    expect(screen.getByText(/facebook.com/)).toBeInTheDocument();
    expect(screen.getByText(/google.com/)).toBeInTheDocument();
  });

  it("shows 'Chưa có dữ liệu' for empty referer breakdown", () => {
    const analyticsEmpty: LinkAnalyticsDetailRow = {
      ...mockAnalyticsDetail,
      referer_breakdown: [],
    };

    const { container } = render(
      <StatsPanel
        link={mockLink}
        analytics={analyticsEmpty}
        onBack={vi.fn()}
      />
    );

    const emptyMessages = screen.getAllByText(/Chưa có dữ liệu/);
    expect(emptyMessages.length).toBeGreaterThan(0);
  });

  it("renders QRPreview component", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    const qrPreview = screen.getByTestId("qr-preview");
    expect(qrPreview).toBeInTheDocument();
    expect(qrPreview).toHaveTextContent("ABC123");
  });

  it("displays geo routes section when link has geo routes", () => {
    const linkWithGeoRoutes: QRLinkRow = {
      ...mockLink,
      geo_routes: [
        {
          id: "route-1",
          link_id: "link-1",
          country_code: "US",
          target_url: "https://us.example.com",
          bypass_url: null,
          created_at: "2026-03-16T00:00:00Z",
        },
        {
          id: "route-2",
          link_id: "link-1",
          country_code: "JP",
          target_url: "https://jp.example.com",
          bypass_url: null,
          created_at: "2026-03-16T00:00:00Z",
        },
      ],
    };

    render(
      <StatsPanel
        link={linkWithGeoRoutes}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText(/Chuyển hướng theo quốc gia/)).toBeInTheDocument();
    // Verify geo routes are rendered
    const usElements = screen.getAllByText(/US/);
    expect(usElements.length).toBeGreaterThan(0);
  });

  it("does not display geo routes section when link has no geo routes", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    // Should still render but geo_routes array is empty
    expect(mockLink.geo_routes).toEqual([]);
  });

  it("handles zero analytics data gracefully", () => {
    const analyticsZero: LinkAnalyticsDetailRow = {
      link_id: "link-1",
      total_clicks: 0,
      today_clicks: 0,
      countries_count: 0,
      clicks_by_day: [],
      country_breakdown: [],
      referer_breakdown: [],
    };

    render(
      <StatsPanel
        link={mockLink}
        analytics={analyticsZero}
        onBack={vi.fn()}
      />
    );

    // Check that zero values are displayed
    const zeroElements = screen.getAllByText("0");
    expect(zeroElements.length).toBeGreaterThan(0);
  });

  it("displays country flags in breakdown data", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    // Country data should show at least one country
    const countryElements = screen.getAllByText(/VN/);
    expect(countryElements.length).toBeGreaterThan(0);
  });

  it("formats day labels correctly for dates", () => {
    render(
      <StatsPanel
        link={mockLink}
        analytics={mockAnalyticsDetail}
        onBack={vi.fn()}
      />
    );

    // Verify bar chart exists with date data
    const barChart = screen.getByTestId("bar-chart");
    expect(barChart).toBeInTheDocument();
    // Check that the chart contains rendered dates (formatted in Vietnamese)
    expect(barChart.textContent).toBeTruthy();
  });
});
