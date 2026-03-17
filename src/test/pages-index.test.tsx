import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { initial, animate, transition, ...rest } = props;
      void initial; void animate; void transition;
      return <div {...rest}>{children as React.ReactNode}</div>;
    },
  },
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

// Mock hooks
const mockLinks = [
  {
    id: "link-1",
    user_id: "user-1",
    name: "Test Link",
    short_code: "ABC123",
    default_url: "https://example.com",
    webhook_url: null,
    has_webhook_secret: false,
    is_active: true,
    created_at: "2026-03-15T00:00:00Z",
    expires_at: null,
    has_password: false,
    qr_config: null,
    geo_routes: [{ id: "r1", link_id: "link-1", country: "Vietnam", country_code: "VN", target_url: "https://vn.example.com" }],
  },
];

vi.mock("@/hooks/use-links", () => ({
  useLinks: () => ({ data: mockLinks, isLoading: false }),
  useLinkAnalyticsSummaries: () => ({
    data: [{ link_id: "link-1", total_clicks: 42, today_clicks: 5, top_country_code: "VN" }],
    isLoading: false,
  }),
  useLinkAnalyticsDetail: () => ({ data: null, isLoading: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockSignOut = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: { email: "test@example.com" },
    signOut: mockSignOut,
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock child components to keep tests focused on Index logic
vi.mock("@/components/CreateLinkDialog", () => ({
  CreateLinkDialog: () => <button>Tạo QR mới</button>,
}));

vi.mock("@/components/EditLinkDialog", () => ({
  EditLinkDialog: () => null,
}));

vi.mock("@/components/LinkCard", () => ({
  LinkCard: ({ link, onSelect, onEdit }: { link: { name: string; id: string }; onSelect: (l: unknown) => void; onEdit: (l: unknown) => void }) => (
    <div data-testid={`link-card-${link.id}`}>
      <span>{link.name}</span>
      <button onClick={() => onSelect(link)}>Stats</button>
      <button onClick={() => onEdit(link)}>Edit</button>
    </div>
  ),
}));

import Index from "@/pages/Index";

function renderIndex() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Index />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Index Page", () => {
  it("renders QRLive header", () => {
    renderIndex();
    expect(screen.getByText("QR")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("displays user email in header", () => {
    renderIndex();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders dashboard stat cards", () => {
    renderIndex();
    expect(screen.getByText("QR Codes")).toBeInTheDocument();
    expect(screen.getByText("Tổng clicks")).toBeInTheDocument();
    expect(screen.getByText("Geo Routes")).toBeInTheDocument();
    expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();
  });

  it("shows correct link count in QR Codes card", () => {
    renderIndex();
    // Find the stat card that contains "QR Codes" label and verify its count
    const qrCodesLabel = screen.getByText("QR Codes");
    const card = qrCodesLabel.closest("div.rounded-xl");
    expect(card).toBeTruthy();
    expect(card!.textContent).toContain("1");
  });

  it("shows total clicks from analytics summaries", () => {
    renderIndex();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows geo routes count", () => {
    renderIndex();
    // mockLinks[0] has 1 geo route
    const geoCount = screen.getAllByText("1");
    expect(geoCount.length).toBeGreaterThanOrEqual(1);
  });

  it("renders link cards for each link", () => {
    renderIndex();
    expect(screen.getByTestId("link-card-link-1")).toBeInTheDocument();
    expect(screen.getByText("Test Link")).toBeInTheDocument();
  });

  it("calls signOut when logout button clicked", async () => {
    mockSignOut.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderIndex();

    await user.click(screen.getByTitle("Đăng xuất"));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("has theme toggle button", () => {
    renderIndex();
    expect(screen.getByTitle("Đổi giao diện")).toBeInTheDocument();
  });
});
