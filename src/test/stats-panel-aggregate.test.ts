import { describe, expect, it } from "vitest";
import { aggregateWeekly } from "@/components/StatsPanel";

describe("aggregateWeekly", () => {
  it("returns an empty array when there is no daily data", () => {
    expect(aggregateWeekly([])).toEqual([]);
  });

  it("groups daily clicks into 7-day buckets", () => {
    const weekly = aggregateWeekly([
      { date: "2026-03-01", clicks: 1 },
      { date: "2026-03-02", clicks: 2 },
      { date: "2026-03-03", clicks: 3 },
      { date: "2026-03-04", clicks: 4 },
      { date: "2026-03-05", clicks: 5 },
      { date: "2026-03-06", clicks: 6 },
      { date: "2026-03-07", clicks: 7 },
      { date: "2026-03-08", clicks: 8 },
    ]);

    expect(weekly).toHaveLength(2);
    expect(weekly[0]).toMatchObject({ clicks: 28 });
    expect(weekly[1]).toMatchObject({ clicks: 8 });
  });
});
