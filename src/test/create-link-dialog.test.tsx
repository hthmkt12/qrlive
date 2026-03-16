import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateLinkDialog } from "@/components/CreateLinkDialog";

// ─── Mock dependencies ────────────────────────────────────────────────────────

const {
  mockCreateLink,
  mockToast,
  mockGetUser,
} = vi.hoisted(() => ({
  mockCreateLink: vi.fn(),
  mockToast: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/hooks/use-link-mutations", () => ({
  useCreateLink: () => ({
    mutateAsync: mockCreateLink,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: mockGetUser(),
  }),
}));

// ─── Test data ────────────────────────────────────────────────────────────────

const mockUser = { id: "user-1", email: "test@example.com" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CreateLinkDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue(mockUser);
  });

  it("does not render dialog content by default", () => {
    render(<CreateLinkDialog />);
    // Dialog title should not be visible initially
    expect(screen.queryByText(/Tạo link QR mới/)).not.toBeInTheDocument();
  });

  it("renders create button", () => {
    render(<CreateLinkDialog />);
    expect(screen.getByText(/Tạo QR mới/)).toBeInTheDocument();
  });

  it("opens dialog when create button is clicked", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });
  });

  it("renders form fields when dialog is open", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tên link/)).toBeInTheDocument();
      expect(screen.getByText(/URL mặc định/)).toBeInTheDocument();
      expect(screen.getByText(/Short code/)).toBeInTheDocument();
    });
  });

  it("submits form with valid data", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockResolvedValue({ id: "link-1" });

    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    // Fill form fields
    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);

    await user.type(nameInput, "Test Link");
    await user.type(urlInput, "https://test.com");

    // Submit form
    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateLink).toHaveBeenCalled();
    });
  });

  it("calls createLink with correct data structure", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockResolvedValue({ id: "link-1" });

    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);

    await user.type(nameInput, "My Link");
    await user.type(urlInput, "https://mylink.com");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateLink).toHaveBeenCalledWith({
        name: "My Link",
        defaultUrl: "https://mylink.com",
        geoRoutes: [],
        userId: "user-1",
        customShortCode: undefined,
        expiresAt: null,
      });
    });
  });

  it("shows success toast on successful creation", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockResolvedValue({ id: "link-1" });

    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);

    await user.type(nameInput, "Test");
    await user.type(urlInput, "https://test.com");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Đã tạo link thành công! 🎉",
      });
    });
  });

  it("closes dialog on successful creation", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockResolvedValue({ id: "link-1" });

    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);

    await user.type(nameInput, "Test");
    await user.type(urlInput, "https://test.com");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      // Dialog should be closed, so title should not be visible
      expect(screen.queryByText(/Tạo link QR mới/)).not.toBeInTheDocument();
    });
  });

  it("shows validation error for invalid URL", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);

    await user.type(nameInput, "Test");
    await user.type(urlInput, "not-a-valid-url");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      // Form validation should show error message for invalid URL
      const errorMessages = screen.queryAllByText(/không hợp lệ/i);
      expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error toast for SHORT_CODE_TAKEN error", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockRejectedValue(new Error("SHORT_CODE_TAKEN"));

    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);
    const shortCodeInput = screen.getByPlaceholderText(/vi-du-cua-toi/);

    await user.type(nameInput, "Test");
    await user.type(urlInput, "https://test.com");
    await user.type(shortCodeInput, "TAKEN");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Short code này đã được dùng, vui lòng chọn cái khác",
        variant: "destructive",
      });
    });
  });

  it("shows error toast for INVALID_SHORT_CODE_FORMAT error", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockRejectedValue(new Error("INVALID_SHORT_CODE_FORMAT"));
    mockToast.mockClear();

    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);

    await user.type(nameInput, "Test");
    await user.type(urlInput, "https://test.com");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/chỉ được chứa chữ cái, số/),
          variant: "destructive",
        })
      );
    });
  });

  it("shows error toast for generic creation error", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockRejectedValue(new Error("Network error"));

    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);

    await user.type(nameInput, "Test");
    await user.type(urlInput, "https://test.com");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Lỗi tạo link",
        variant: "destructive",
      });
    });
  });

  it("shows error toast when user is not authenticated", async () => {
    const user = userEvent.setup();
    mockGetUser.mockReturnValue(null);

    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);

    await user.type(nameInput, "Test");
    await user.type(urlInput, "https://test.com");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Vui lòng đăng nhập trước",
        variant: "destructive",
      });
    });
  });

  it("accepts custom short code in submission", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockResolvedValue({ id: "link-1" });

    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/);
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/);
    const shortCodeInput = screen.getByPlaceholderText(/vi-du-cua-toi/);

    await user.type(nameInput, "My Link");
    await user.type(urlInput, "https://mylink.com");
    await user.type(shortCodeInput, "MY-LINK");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateLink).toHaveBeenCalledWith({
        name: "My Link",
        defaultUrl: "https://mylink.com",
        geoRoutes: [],
        userId: "user-1",
        customShortCode: "MY-LINK",
        expiresAt: null,
      });
    });
  });

  it("adds geo route when add button is clicked", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    // Find and click the add geo route button
    const addButtons = screen.getAllByText(/Thêm/);
    // Second "Thêm" is for geo routes (first is in the dialog header)
    await user.click(addButtons[0]);

    await waitFor(() => {
      // Should see a country select dropdown
      expect(screen.getByDisplayValue(/Chọn quốc gia/)).toBeInTheDocument();
    });
  });

  it("allows adding geo routes", async () => {
    const user = userEvent.setup();
    render(<CreateLinkDialog />);

    const createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    // Verify geo routes section exists
    expect(screen.getByText(/Chuyển hướng theo quốc gia/)).toBeInTheDocument();

    // Find the add geo route button
    const addButtons = screen.getAllByText(/Thêm/);
    const addGeoButton = addButtons[0];
    expect(addGeoButton).toBeInTheDocument();

    // Click to add a geo route
    await user.click(addGeoButton);

    // Verify a country selector appears
    const countrySelects = screen.getAllByDisplayValue(/Chọn quốc gia/);
    expect(countrySelects.length).toBeGreaterThan(0);
  });

  it("resets form after successful submission", async () => {
    const user = userEvent.setup();
    mockCreateLink.mockResolvedValue({ id: "link-1" });

    render(<CreateLinkDialog />);

    // First submission
    let createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/) as HTMLInputElement;
    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/) as HTMLInputElement;

    await user.type(nameInput, "Test");
    await user.type(urlInput, "https://test.com");

    const submitButton = screen.getByText(/Tạo link & QR Code/);
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText(/Tạo link QR mới/)).not.toBeInTheDocument();
    });

    // Open dialog again
    createButton = screen.getByText(/Tạo QR mới/);
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Tạo link QR mới/)).toBeInTheDocument();
    });

    // Form fields should be reset
    const resetNameInput = screen.getByPlaceholderText(/Ví dụ: Netflix US/) as HTMLInputElement;
    expect(resetNameInput.value).toBe("");
  });
});
