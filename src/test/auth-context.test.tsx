import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/contexts/auth-context";

// ─── Mock Supabase client ─────────────────────────────────────────────────────
// vi.hoisted ensures mocks are defined before vi.mock factory runs (Vitest hoists vi.mock calls)

const {
  mockGetSession,
  mockOnAuthStateChange,
  mockSignInWithPassword,
  mockSignUp,
  mockSignOut,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
    },
  },
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Renders a component that exposes auth context values via data-testid */
function AuthConsumer() {
  const { user, loading, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : "null"}</span>
      <button onClick={() => signIn("test@example.com", "password123")}>Sign In</button>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

const mockSubscription = { unsubscribe: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no active session, auth state listener returns subscription
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: mockSubscription } });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AuthProvider", () => {
  it("starts in loading state then resolves to unauthenticated", async () => {
    renderWithAuth();
    // Loading resolves after getSession
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("resolves with user when an active session exists", async () => {
    const mockUser = { email: "user@example.com", id: "user-123" };
    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("user@example.com");
    });
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("sets loading=false even when getSession rejects (network error)", async () => {
    mockGetSession.mockRejectedValue(new Error("Network error"));

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("unsubscribes from auth state changes on unmount", async () => {
    const { unmount } = renderWithAuth();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    unmount();
    expect(mockSubscription.unsubscribe).toHaveBeenCalledOnce();
  });

  it("calls signInWithPassword with correct credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    await act(async () => {
      await userEvent.click(screen.getByText("Sign In"));
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("signIn propagates Supabase error to caller", async () => {
    const supabaseError = { message: "Invalid credentials" };
    mockSignInWithPassword.mockResolvedValue({ error: supabaseError });

    // Test the signIn function directly via a custom render that captures the thrown error
    let caughtError: unknown = null;
    function ErrorCapture() {
      const { signIn } = useAuth();
      return (
        <button
          onClick={async () => {
            try { await signIn("bad@example.com", "wrongpass"); }
            catch (e) { caughtError = e; }
          }}
        >
          Try Sign In
        </button>
      );
    }

    render(<AuthProvider><ErrorCapture /></AuthProvider>);
    await waitFor(() => {}); // let getSession resolve

    await act(async () => {
      await userEvent.click(screen.getByText("Try Sign In"));
    });

    expect(caughtError).toEqual(supabaseError);
  });

  it("calls signOut", async () => {
    mockSignOut.mockResolvedValue({ error: null });
    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    await act(async () => {
      await userEvent.click(screen.getByText("Sign Out"));
    });

    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});

describe("useAuth outside provider", () => {
  it("throws when used outside AuthProvider", () => {
    // Suppress expected React error boundary output
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<AuthConsumer />)).toThrow("useAuth must be used within AuthProvider");
    consoleSpy.mockRestore();
  });
});
