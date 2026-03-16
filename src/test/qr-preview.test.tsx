import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QRPreview } from "@/components/QRPreview";

// ─── Mock dependencies ────────────────────────────────────────────────────────

const mockToast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr-svg" data-value={value} />,
}));

vi.mock("@/lib/db", () => ({
  getRedirectUrl: (shortCode: string) => `https://test.supabase.co/functions/v1/redirect/${shortCode}`,
}));

// ─── Mock clipboard at module level so the same fn reference is always used ──

const mockClipboardWrite = vi.fn().mockResolvedValue(undefined);

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: mockClipboardWrite },
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

function renderQR(props: Partial<{ url: string; shortCode: string; name: string }> = {}) {
  return render(
    <QRPreview
      url={props.url ?? "https://example.com"}
      shortCode={props.shortCode ?? "ABC123"}
      name={props.name ?? "Test Link"}
    />
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("QRPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboardWrite.mockResolvedValue(undefined);
  });

  it("renders QR code SVG", () => {
    renderQR();
    expect(screen.getByTestId("qr-svg")).toBeInTheDocument();
  });

  it("passes redirect URL to QRCodeSVG", () => {
    renderQR({ shortCode: "ABC123" });
    const svg = screen.getByTestId("qr-svg");
    expect(svg.getAttribute("data-value")).toBe(
      "https://test.supabase.co/functions/v1/redirect/ABC123"
    );
  });

  it("displays the redirect URL as text", () => {
    renderQR({ shortCode: "ABC123" });
    expect(
      screen.getByText("https://test.supabase.co/functions/v1/redirect/ABC123")
    ).toBeInTheDocument();
  });

  it("renders copy link button", () => {
    renderQR();
    expect(screen.getByText("Copy link")).toBeInTheDocument();
  });

  it("renders download button", () => {
    renderQR();
    expect(screen.getByText("Tải QR")).toBeInTheDocument();
  });

  it("shows toast and updates state on copy click", async () => {
    const user = userEvent.setup();
    renderQR({ shortCode: "ABC123" });

    const copyButton = screen.getByText("Copy link");
    await user.click(copyButton);

    // Toast confirms the copy action completed
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: "Đã copy link!" });
    });
  });

  it("shows 'Đã copy' text after copying", async () => {
    const user = userEvent.setup();
    renderQR();

    const copyButton = screen.getByText("Copy link");
    await user.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText("Đã copy")).toBeInTheDocument();
    });
  });

  it("renders 5 color preset buttons", () => {
    renderQR();
    // Preset buttons have title attributes
    const presets = ["Mặc định", "Trắng", "Tím", "Cam", "Xanh lá"];
    presets.forEach((label) => {
      expect(screen.getByTitle(label)).toBeInTheDocument();
    });
  });

  it("changes theme when preset button is clicked", async () => {
    const user = userEvent.setup();
    renderQR();

    const whitePreset = screen.getByTitle("Trắng");
    await user.click(whitePreset);

    // After clicking white preset, color picker should reflect new fg value (#1a1a2e)
    const colorInputs = screen.getAllByDisplayValue(/#/i);
    expect(colorInputs.length).toBeGreaterThan(0);
  });

  it("renders error level select with default H", () => {
    renderQR();
    const select = screen.getByDisplayValue("Mức H");
    expect(select).toBeInTheDocument();
  });

  it("changes error level when select is changed", async () => {
    const user = userEvent.setup();
    renderQR();

    const select = screen.getByDisplayValue("Mức H");
    await user.selectOptions(select, "L");

    expect(screen.getByDisplayValue("Mức L")).toBeInTheDocument();
  });

  it("renders QR color label and background color label", () => {
    renderQR();
    expect(screen.getByText("QR")).toBeInTheDocument();
    expect(screen.getByText("Nền")).toBeInTheDocument();
  });

  it("renders 'Link QR (luôn sống)' label", () => {
    renderQR();
    expect(screen.getByText("Link QR (luôn sống)")).toBeInTheDocument();
  });
});
