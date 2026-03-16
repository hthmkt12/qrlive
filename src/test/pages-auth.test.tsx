import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";

// Mock auth context
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    user: null,
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import Auth from "@/pages/Auth";

function renderAuth() {
  return render(
    <BrowserRouter>
      <Auth />
    </BrowserRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Auth Page", () => {
  it("renders login form by default", () => {
    renderAuth();
    expect(screen.getByText("Đăng nhập vào tài khoản")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  it("switches to signup mode when toggle clicked", async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByText("Đăng ký"));

    expect(screen.getByText("Tạo tài khoản mới")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng ký" })).toBeInTheDocument();
  });

  it("switches back to login mode", async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByText("Đăng ký")); // switch to signup
    await user.click(screen.getByText("Đăng nhập")); // switch back

    expect(screen.getByText("Đăng nhập vào tài khoản")).toBeInTheDocument();
  });

  it("calls signIn on login form submit", async () => {
    mockSignIn.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuth();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "password123");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "password123");
    });
  });

  it("calls signUp on signup form submit", async () => {
    mockSignUp.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAuth();

    // Switch to signup
    await user.click(screen.getByText("Đăng ký"));

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "password123");
    await user.click(screen.getByRole("button", { name: "Đăng ký" }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "password123");
    });
  });

  it("shows normalized error for invalid credentials", async () => {
    mockSignIn.mockRejectedValue(new Error("Invalid login credentials"));
    const user = userEvent.setup();
    renderAuth();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => {
      expect(screen.getByText("Email hoặc mật khẩu không đúng")).toBeInTheDocument();
    });
  });

  it("shows normalized error for already registered email", async () => {
    mockSignUp.mockRejectedValue(new Error("User already registered"));
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByText("Đăng ký"));
    await user.type(screen.getByLabelText("Email"), "existing@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "password123");
    await user.click(screen.getByRole("button", { name: "Đăng ký" }));

    await waitFor(() => {
      expect(screen.getByText("Email này đã được đăng ký")).toBeInTheDocument();
    });
  });

  it("shows generic error for unknown errors", async () => {
    mockSignIn.mockRejectedValue(new Error("Some unknown error"));
    const user = userEvent.setup();
    renderAuth();

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "password123");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => {
      expect(screen.getByText("Đã có lỗi xảy ra. Vui lòng thử lại")).toBeInTheDocument();
    });
  });

  it("clears server error when switching modes", async () => {
    mockSignIn.mockRejectedValue(new Error("Invalid login credentials"));
    const user = userEvent.setup();
    renderAuth();

    // Trigger error
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Mật khẩu"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => {
      expect(screen.getByText("Email hoặc mật khẩu không đúng")).toBeInTheDocument();
    });

    // Switch to signup — error should clear
    await user.click(screen.getByText("Đăng ký"));
    expect(screen.queryByText("Email hoặc mật khẩu không đúng")).not.toBeInTheDocument();
  });

  it("shows QRLive branding", () => {
    renderAuth();
    expect(screen.getByText("QR")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});
