import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditLinkDialog } from "@/components/EditLinkDialog";
import { QRLinkRow } from "@/lib/db";

const { mockUpdateLink, mockUpdateGeoRoutes, mockToast } = vi.hoisted(() => ({
  mockUpdateLink: vi.fn(),
  mockUpdateGeoRoutes: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock("@/hooks/use-link-mutations", () => ({
  useUpdateLink: () => ({ mutateAsync: mockUpdateLink, isPending: false }),
  useUpdateGeoRoutes: () => ({ mutateAsync: mockUpdateGeoRoutes, isPending: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const baseLink: QRLinkRow = {
  id: "link-1",
  user_id: "user-1",
  name: "Test QR Link",
  short_code: "ABC123",
  default_url: "https://example.com",
  webhook_url: null,
  is_active: true,
  created_at: "2026-03-16T00:00:00Z",
  expires_at: null,
  geo_routes: [],
  has_password: false,
  qr_config: null,
};

const protectedLink: QRLinkRow = { ...baseLink, has_password: true };
const linkWithGeoRoutes: QRLinkRow = {
  ...baseLink,
  geo_routes: [{
    id: "route-1",
    link_id: "link-1",
    country: "Vietnam",
    country_code: "VN",
    target_url: "https://vn.example.com",
    bypass_url: null,
    created_at: "2026-03-16T00:00:00Z",
  }],
};

function renderDialog(link: QRLinkRow | null = baseLink, onOpenChange = vi.fn()) {
  return render(<EditLinkDialog link={link} open={true} onOpenChange={onOpenChange} />);
}

describe("EditLinkDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateLink.mockResolvedValue(undefined);
    mockUpdateGeoRoutes.mockResolvedValue(undefined);
  });

  it("renders nothing when link is null", () => {
    const { container } = render(<EditLinkDialog link={null} open={true} onOpenChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("pre-fills link fields and geo routes", async () => {
    renderDialog(linkWithGeoRoutes);
    expect(screen.getByDisplayValue("Test QR Link")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("🇻🇳 Vietnam")).toBeInTheDocument();
  });

  it("keeps password unchanged when user saves without touching it", async () => {
    const user = userEvent.setup();
    renderDialog(protectedLink);
    const nameInput = screen.getByDisplayValue("Test QR Link");

    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");
    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(mockUpdateLink).toHaveBeenCalledWith(expect.objectContaining({
        id: "link-1",
        updates: expect.objectContaining({ name: "Updated Name" }),
        password: undefined,
      }));
    });
  });

  it("only clears password after explicit clear action", async () => {
    const user = userEvent.setup();
    renderDialog(protectedLink);

    await user.click(screen.getByRole("button", { name: /Xóa mật khẩu hiện tại/i }));
    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(mockUpdateLink).toHaveBeenCalledWith(expect.objectContaining({ password: "" }));
    });
  });

  it("prefers a new password if user types after choosing clear", async () => {
    const user = userEvent.setup();
    renderDialog(protectedLink);

    await user.click(screen.getByRole("button", { name: /Xóa mật khẩu hiện tại/i }));
    await user.type(screen.getByPlaceholderText(/Nhập mật khẩu mới/i), "new-secret");
    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(mockUpdateLink).toHaveBeenCalledWith(expect.objectContaining({ password: "new-secret" }));
    });
  });

  it("submits geo route updates and closes on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog(baseLink, onOpenChange);

    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(mockUpdateGeoRoutes).toHaveBeenCalledWith({ linkId: "link-1", geoRoutes: [] });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockToast).toHaveBeenCalledWith({ title: "Đã cập nhật thành công! ✨" });
    });
  });

  it("shows error toast when update fails", async () => {
    const user = userEvent.setup();
    mockUpdateLink.mockRejectedValue(new Error("Network error"));
    renderDialog();

    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Lỗi cập nhật",
        description: "Network error",
        variant: "destructive",
      });
    });
  });

  it("shows validation errors for empty name and invalid URL", async () => {
    const user = userEvent.setup();
    renderDialog();
    const nameInput = screen.getByDisplayValue("Test QR Link");
    const urlInput = screen.getByDisplayValue("https://example.com");

    await user.clear(nameInput);
    await user.clear(urlInput);
    await user.type(urlInput, "not-a-url");
    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/i }));

    expect(await screen.findByText(/Tên không được để trống/i)).toBeInTheDocument();
    expect(screen.getByText(/URL mặc định không hợp lệ/i)).toBeInTheDocument();
  });

  it("adds and removes geo routes", async () => {
    const user = userEvent.setup();
    renderDialog(linkWithGeoRoutes);

    await screen.findByDisplayValue("🇻🇳 Vietnam");
    await user.click(screen.getByRole("button", { name: /Thêm/i }));
    expect(screen.getAllByDisplayValue(/Chọn quốc gia/i)).toHaveLength(1);
    const currentRouteInput = screen.getByDisplayValue("https://vn.example.com");
    const removeButton = currentRouteInput.parentElement?.querySelector("button[type='button']") as HTMLButtonElement;
    await user.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByDisplayValue("https://vn.example.com")).not.toBeInTheDocument();
    });
  });
});
