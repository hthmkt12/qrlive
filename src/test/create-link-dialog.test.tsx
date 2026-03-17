import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateLinkDialog } from "@/components/CreateLinkDialog";

const { mockCreateLink, mockToast, mockGetUser } = vi.hoisted(() => ({
  mockCreateLink: vi.fn(),
  mockToast: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/hooks/use-link-mutations", () => ({
  useCreateLink: () => ({ mutateAsync: mockCreateLink, isPending: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: mockGetUser() }),
}));

const mockUser = { id: "user-1", email: "test@example.com" };

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Tạo QR mới/i }));
  await screen.findByRole("dialog");
}

async function fillBaseForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/Ví dụ: Netflix US/i), "Test Link");
  await user.type(screen.getByPlaceholderText(/^https:\/\/example\.com$/i), "https://test.com");
}

describe("CreateLinkDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue(mockUser);
    mockCreateLink.mockResolvedValue({ id: "link-1" });
  });

  it("does not render dialog content by default", () => {
    render(<CreateLinkDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the dialog and renders the new webhook field", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);

    expect(screen.getByPlaceholderText(/Ví dụ: Netflix US/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/webhooks\/qrlive/i)).toBeInTheDocument();
    expect(screen.getByText(/không gửi cho bot hoặc click trùng trong 60 giây/i)).toBeInTheDocument();
  });

  it("submits form with valid data", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    await waitFor(() => {
      expect(mockCreateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Link",
          defaultUrl: "https://test.com",
          geoRoutes: [],
          userId: "user-1",
          expiresAt: null,
        })
      );
    });
  });

  it("includes custom short code when provided", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.type(screen.getByPlaceholderText(/vi-du-cua-toi/i), "MY-LINK");
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    await waitFor(() => {
      expect(mockCreateLink).toHaveBeenCalledWith(
        expect.objectContaining({ customShortCode: "MY-LINK" })
      );
    });
  });

  it("includes webhookUrl when provided", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.type(screen.getByPlaceholderText(/webhooks\/qrlive/i), "https://hooks.example.com/qrlive");
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    await waitFor(() => {
      expect(mockCreateLink).toHaveBeenCalledWith(
        expect.objectContaining({ webhookUrl: "https://hooks.example.com/qrlive" })
      );
    });
  });

  it("shows success toast and closes after creating a link", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: "Đã tạo link thành công! 🎉" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("resets the form after a successful submission", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openDialog(user);
    expect((screen.getByPlaceholderText(/Ví dụ: Netflix US/i) as HTMLInputElement).value).toBe("");
  });

  it("shows validation error for an invalid default URL", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);
    await user.type(screen.getByPlaceholderText(/Ví dụ: Netflix US/i), "Test Link");
    await user.type(screen.getByPlaceholderText(/^https:\/\/example\.com$/i), "not-a-valid-url");
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    expect(await screen.findByText(/URL mặc định không hợp lệ/i)).toBeInTheDocument();
  });

  it("shows validation error for an invalid webhook URL", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.type(screen.getByPlaceholderText(/webhooks\/qrlive/i), "http://hooks.example.com/qrlive");
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    expect(await screen.findByText(/Webhook URL phải bắt đầu bằng https:\/\//i)).toBeInTheDocument();
  });

  it("shows a destructive toast for SHORT_CODE_TAKEN", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockRejectedValue(new Error("SHORT_CODE_TAKEN"));
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.type(screen.getByPlaceholderText(/vi-du-cua-toi/i), "TAKEN");
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Short code này đã được dùng, vui lòng chọn cái khác",
        variant: "destructive",
      });
    });
  });

  it("shows a destructive toast for INVALID_SHORT_CODE_FORMAT", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockRejectedValue(new Error("INVALID_SHORT_CODE_FORMAT"));
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/Short code chỉ được chứa chữ cái/i),
          variant: "destructive",
        })
      );
    });
  });

  it("shows a generic creation error when the mutation fails", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockRejectedValue(new Error("Network error"));
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Lỗi tạo link",
        variant: "destructive",
      });
    });
  });

  it("shows an auth-required toast when the user is missing", async () => {
    const user = userEvent.setup();
    mockGetUser.mockReturnValue(null);
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Vui lòng đăng nhập trước",
        variant: "destructive",
      });
    });
  });

  it("adds a geo route row when requested", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);
    await user.click(screen.getByRole("button", { name: /^Thêm$/i }));

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/URL đích/i)).toBeInTheDocument();
  });

  it("keeps webhookUrl undefined when the field is left blank", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    await openDialog(user);
    await fillBaseForm(user);
    await user.click(screen.getByRole("button", { name: /Tạo link & QR Code/i }));

    await waitFor(() => {
      expect(mockCreateLink).toHaveBeenCalledWith(
        expect.objectContaining({ webhookUrl: undefined })
      );
    });
  });
});
