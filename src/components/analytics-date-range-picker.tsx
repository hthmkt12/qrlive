// Date range selector for analytics — preset buttons (7/30/90 ngay) + custom date inputs
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type DateRange = {
  startDate: string; // ISO date "YYYY-MM-DD"
  endDate: string;   // ISO date "YYYY-MM-DD"
};

type Preset = "7d" | "30d" | "90d" | "custom";

interface AnalyticsDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function presetRange(days: number): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

const PRESETS: { key: Preset; label: string; days?: number }[] = [
  { key: "7d",     label: "7 ngày",   days: 7 },
  { key: "30d",    label: "30 ngày",  days: 30 },
  { key: "90d",    label: "90 ngày",  days: 90 },
  { key: "custom", label: "Tuỳ chọn" },
];

export function AnalyticsDateRangePicker({ value, onChange }: AnalyticsDateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<Preset>("7d");

  function handlePreset(preset: (typeof PRESETS)[number]) {
    setActivePreset(preset.key);
    if (preset.days) {
      onChange(presetRange(preset.days));
    }
    // "custom" — keep existing custom dates, just reveal inputs
  }

  function handleCustomStart(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ startDate: e.target.value, endDate: value.endDate });
  }

  function handleCustomEnd(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ startDate: value.startDate, endDate: e.target.value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset.key}
          variant={activePreset === preset.key ? "default" : "outline"}
          size="sm"
          onClick={() => handlePreset(preset)}
        >
          {preset.label}
        </Button>
      ))}

      {activePreset === "custom" && (
        <div className="flex items-center gap-1 text-sm">
          <input
            type="date"
            value={value.startDate}
            max={value.endDate}
            onChange={handleCustomStart}
            className="rounded border border-border bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Ngày bắt đầu"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            value={value.endDate}
            min={value.startDate}
            onChange={handleCustomEnd}
            className="rounded border border-border bg-card px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Ngày kết thúc"
          />
        </div>
      )}
    </div>
  );
}
