import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyticsDateRangePicker, type DateRange } from "@/components/analytics-date-range-picker";

describe("AnalyticsDateRangePicker", () => {
  const defaultRange: DateRange = { startDate: "2026-03-10", endDate: "2026-03-16" };

  it("renders all 4 preset buttons", () => {
    render(<AnalyticsDateRangePicker value={defaultRange} onChange={vi.fn()} />);
    expect(screen.getByText("7 ngày")).toBeInTheDocument();
    expect(screen.getByText("30 ngày")).toBeInTheDocument();
    expect(screen.getByText("90 ngày")).toBeInTheDocument();
    expect(screen.getByText("Tuỳ chọn")).toBeInTheDocument();
  });

  it("does not show custom date inputs by default", () => {
    render(<AnalyticsDateRangePicker value={defaultRange} onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Ngày bắt đầu")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ngày kết thúc")).not.toBeInTheDocument();
  });

  it("shows custom date inputs when 'Tuỳ chọn' is clicked", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDateRangePicker value={defaultRange} onChange={vi.fn()} />);

    await user.click(screen.getByText("Tuỳ chọn"));

    expect(screen.getByLabelText("Ngày bắt đầu")).toBeInTheDocument();
    expect(screen.getByLabelText("Ngày kết thúc")).toBeInTheDocument();
  });

  it("calls onChange with 7-day range when '7 ngày' is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AnalyticsDateRangePicker value={defaultRange} onChange={onChange} />);

    await user.click(screen.getByText("7 ngày"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    );
  });

  it("calls onChange with 30-day range when '30 ngày' is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AnalyticsDateRangePicker value={defaultRange} onChange={onChange} />);

    await user.click(screen.getByText("30 ngày"));

    expect(onChange).toHaveBeenCalledOnce();
    const range = onChange.mock.calls[0][0] as DateRange;
    // 30-day range: difference should be 29 days (inclusive)
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
    expect(diffDays).toBe(29);
  });

  it("calls onChange with 90-day range when '90 ngày' is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AnalyticsDateRangePicker value={defaultRange} onChange={onChange} />);

    await user.click(screen.getByText("90 ngày"));

    expect(onChange).toHaveBeenCalledOnce();
    const range = onChange.mock.calls[0][0] as DateRange;
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
    expect(diffDays).toBe(89);
  });

  it("does not call onChange when 'Tuỳ chọn' is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AnalyticsDateRangePicker value={defaultRange} onChange={onChange} />);

    await user.click(screen.getByText("Tuỳ chọn"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("custom date inputs reflect current value", async () => {
    const user = userEvent.setup();
    render(
      <AnalyticsDateRangePicker
        value={{ startDate: "2026-01-15", endDate: "2026-02-20" }}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByText("Tuỳ chọn"));

    const startInput = screen.getByLabelText("Ngày bắt đầu") as HTMLInputElement;
    const endInput = screen.getByLabelText("Ngày kết thúc") as HTMLInputElement;
    expect(startInput.value).toBe("2026-01-15");
    expect(endInput.value).toBe("2026-02-20");
  });

  it("hides custom date inputs after switching back to a preset", async () => {
    const user = userEvent.setup();
    render(<AnalyticsDateRangePicker value={defaultRange} onChange={vi.fn()} />);

    // Show custom inputs
    await user.click(screen.getByText("Tuỳ chọn"));
    expect(screen.getByLabelText("Ngày bắt đầu")).toBeInTheDocument();

    // Switch back to preset
    await user.click(screen.getByText("7 ngày"));
    expect(screen.queryByLabelText("Ngày bắt đầu")).not.toBeInTheDocument();
  });
});
