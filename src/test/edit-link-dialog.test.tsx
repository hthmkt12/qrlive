import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditLinkDialog } from "@/components/EditLinkDialog";
import { QRLinkRow } from "@/lib/db";

// ─── Mock dependencies ────────────────────────────────────────────────────────

const {
  mockUpdateLink,
  mockUpdateGeoRoutes,
  mockToast,
} = vi.hoisted(() => ({
  mockUpdateLink: vi.fn(),
  mockUpdateGeoRoutes: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("@/hooks/use-link-mutations", () => ({
  useUpdateLink: () => ({
    mutateAsync: mockUpdateLink,
    isPending: false,
  }),
  useUpdateGeoRoutes: () => ({
    mutateAsync: mockUpdateGeoRoutes,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
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
  expires_at: null,
  geo_routes: [],
  password_hash: null,
  password_salt: null,
};

const mockLinkWithGeoRoutes: QRLinkRow = {
  ...mockLink,
  geo_routes: [
    {
      id: "route-1",
      link_id: "link-1",
      country: "Vietnam",
      country_code: "VN",
      target_url: "https://vn.example.com",
      bypass_url: null,
      created_at: "2026-03-16T00:00:00Z",
    },
  ],
};

function renderDialog(link: QRLinkRow | null = mockLink, open = true, onOpenChange = vi.fn()) {
  return render(
    <EditLinkDialog link={link} open={open} onOpenChange={onOpenChange} />
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("EditLinkDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when link is null", () => {
    const { container } = render(
      <EditLinkDialog link={null} open={true} onOpenChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render dialog content when open is false", () => {
    renderDialog(mockLink, false);
    expect(screen.queryByText(/Chỉnh sửa link/)).not.toBeInTheDocument();
  });

  it("renders dialog title when open", () => {
    renderDialog();
    expect(screen.getByText("Chỉnh sửa link")).toBeInTheDocument();
  });

  it("pre-fills form with existing link data", () => {
    renderDialog();
    const nameInput = screen.getByDisplayValue("Test QR Link");
    const urlInput = screen.getByDisplayValue("https://example.com");
    expect(nameInput).toBeInTheDocument();
    expect(urlInput).toBeInTheDocument();
  });

  it("pre-fills geo routes when link has them", () => {
    renderDialog(mockLinkWithGeoRoutes);
    // VN route should be pre-selected
    const countrySelect = screen.getByDisplayValue("🇻🇳 Vietnam");
    expect(countrySelect).toBeInTheDocument();
  });

  it("submits with updated name and URL", async () => {
    const user = userEvent.setup();
    mockUpdateLink.mockResolvedValue(undefined);
    mockUpdateGeoRoutes.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    renderDialog(mockLink, true, onOpenChange);

    const nameInput = screen.getByDisplayValue("Test QR Link");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");

    const submitButton = screen.getByText(/Lưu thay đổi/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateLink).toHaveBeenCalledWith({
        id: "link-1",
        updates: { name: "Updated Name", default_url: "https://example.com", expires_at: null },
        password: "",
      });
    });
  });

  it("calls updateGeoRoutes on submit", async () => {
    const user = userEvent.setup();
    mockUpdateLink.mockResolvedValue(undefined);
    mockUpdateGeoRoutes.mockResolvedValue(undefined);

    renderDialog();

    const submitButton = screen.getByText(/Lưu thay đổi/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateGeoRoutes).toHaveBeenCalledWith({
        linkId: "link-1",
        geoRoutes: [],
      });
    });
  });

  it("shows success toast on successful update", async () => {
    const user = userEvent.setup();
    mockUpdateLink.mockResolvedValue(undefined);
    mockUpdateGeoRoutes.mockResolvedValue(undefined);

    renderDialog();

    const submitButton = screen.getByText(/Lưu thay đổi/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: "Đã cập nhật thành công! ✅" });
    });
  });

  it("closes dialog on successful update", async () => {
    const user = userEvent.setup();
    mockUpdateLink.mockResolvedValue(undefined);
    mockUpdateGeoRoutes.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    renderDialog(mockLink, true, onOpenChange);

    const submitButton = screen.getByText(/Lưu thay đổi/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows error toast on update failure", async () => {
    const user = userEvent.setup();
    mockUpdateLink.mockRejectedValue(new Error("Network error"));

    renderDialog();

    const submitButton = screen.getByText(/Lưu thay đổi/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Lỗi cập nhật",
        description: "Network error",
        variant: "destructive",
      });
    });
  });

  it("shows validation error for empty name", async () => {
    const user = userEvent.setup();
    renderDialog();

    const nameInput = screen.getByDisplayValue("Test QR Link");
    await user.clear(nameInput);

    const submitButton = screen.getByText(/Lưu thay đổi/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Tên không được để trống/)).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid URL", async () => {
    const user = userEvent.setup();
    renderDialog();

    const urlInput = screen.getByDisplayValue("https://example.com");
    await user.clear(urlInput);
    await user.type(urlInput, "not-a-url");

    const submitButton = screen.getByText(/Lưu thay đổi/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/URL mặc định không hợp lệ/)).toBeInTheDocument();
    });
  });

  it("adds a geo route when add button is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();

    // "Thêm" appears in the label row — use getAllByText and pick the button
    const addButtons = screen.getAllByText(/Thêm/);
    const addButton = addButtons.find((el) => el.tagName === "BUTTON" || el.closest("button") !== null);
    await user.click(addButton!);

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Chọn quốc gia/)).toBeInTheDocument();
    });
  });

  it("removes a geo route when delete button is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderDialog(mockLinkWithGeoRoutes);

    // Wait for geo route to appear (useEffect re-populates the form)
    await screen.findByDisplayValue("🇻🇳 Vietnam");

    // All icon-sized buttons inside the form: [Add geo route, Remove geo route]
    // The remove button is the one containing a trash SVG
    const allButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('form button[type="button"]'));
    const removeBtn = allButtons.find((btn) =>
      btn.querySelector("svg")?.classList.toString().includes("trash")
    );
    expect(removeBtn).toBeDefined();

    await user.click(removeBtn!);

    await waitFor(() => {
      expect(screen.queryByDisplayValue("🇻🇳 Vietnam")).not.toBeInTheDocument();
    });
  });

  it("renders geo routes section label", () => {
    renderDialog();
    expect(screen.getByText(/Chuyển hướng theo quốc gia/)).toBeInTheDocument();
  });

  it("shows placeholder text when no geo routes", () => {
    renderDialog();
    expect(screen.getByText(/Thêm rule để chuyển hướng/)).toBeInTheDocument();
  });

  it("does not show placeholder when geo routes exist", () => {
    renderDialog(mockLinkWithGeoRoutes);
    expect(screen.queryByText(/Thêm rule để chuyển hướng/)).not.toBeInTheDocument();
  });
});
