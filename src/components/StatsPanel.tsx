import { lazy, Suspense, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Globe, MousePointerClick, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { COUNTRIES } from "@/lib/types";
import { LinkAnalyticsDetailRow, QRLinkRow } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { QRPreview } from "./QRPreview";
import { AnalyticsDateRangePicker, DateRange } from "./analytics-date-range-picker";
import { useLinkAnalyticsDetailV2 } from "@/hooks/use-links";

// Lazy-load the recharts-heavy visualizations — only fetched when StatsPanel actually renders
const StatsCharts = lazy(() => import("./StatsCharts"));

interface StatsPanelProps {
  link: QRLinkRow;
  analytics: LinkAnalyticsDetailRow; // fallback / initial data
  isLoading?: boolean;
  onBack: () => void;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function defaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

function formatDayLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "numeric",
  });
}

/** Aggregate daily clicks into weekly buckets for ranges > 30 days */
function aggregateWeekly(days: LinkAnalyticsDetailRow["clicks_by_day"]) {
  const weeks: { date: string; clicks: number }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    const label = formatDayLabel(slice[0].date);
    const clicks = slice.reduce((sum, d) => sum + d.clicks, 0);
    weeks.push({ date: label, clicks });
  }
  return weeks;
}

function rangeDays(range: DateRange): number {
  const ms = new Date(range.endDate).getTime() - new Date(range.startDate).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export function StatsPanel({ link, analytics: fallbackAnalytics, isLoading: externalLoading = false, onBack }: StatsPanelProps) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);

  const { data: rangedAnalytics, isLoading: rangedLoading } = useLinkAnalyticsDetailV2(
    link.id,
    dateRange.startDate,
    dateRange.endDate
  );

  const analytics = rangedAnalytics ?? fallbackAnalytics;
  const isLoading = externalLoading || rangedLoading;
  const days = rangeDays(dateRange);

  const chartData = days > 30
    ? aggregateWeekly(analytics.clicks_by_day)
    : analytics.clicks_by_day.map((entry) => ({ date: formatDayLabel(entry.date), clicks: entry.clicks }));

  const chartTitle = days <= 7 ? "Clicks 7 ngày qua" : days <= 30 ? `Clicks ${days} ngày qua` : `Clicks ${days} ngày (theo tuần)`;

  const totalClicks = analytics.total_clicks;

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại
      </Button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <QRPreview url={link.default_url} shortCode={link.short_code} name={link.name} />

          {link.geo_routes?.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Globe className="h-4 w-4 text-primary" />
                Chuyển hướng theo quốc gia
              </h4>
              {link.geo_routes.map((route) => {
                const country = COUNTRIES.find((item) => item.code === route.country_code);
                return (
                  <div key={route.id ?? route.country_code} className="mb-2 flex items-center gap-2 text-sm">
                    <span>{country?.flag}</span>
                    <span className="font-mono text-muted-foreground">{route.country_code}</span>
                    <span className="text-muted-foreground">-&gt;</span>
                    <span className="truncate font-mono text-xs text-primary">{route.target_url}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* Summary cards — all-time, not filtered by date range */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <MousePointerClick className="mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">{isLoading ? "..." : totalClicks}</p>
              <p className="text-xs text-muted-foreground">Tổng clicks</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <TrendingUp className="mb-2 h-5 w-5 text-success" />
              <p className="text-2xl font-bold">{isLoading ? "..." : analytics.today_clicks}</p>
              <p className="text-xs text-muted-foreground">Hôm nay</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Globe className="mb-2 h-5 w-5 text-warning" />
              <p className="text-2xl font-bold">{isLoading ? "..." : analytics.countries_count}</p>
              <p className="text-xs text-muted-foreground">Quốc gia</p>
            </div>
          </div>

          {/* Date range selector */}
          <AnalyticsDateRangePicker value={dateRange} onChange={setDateRange} />

          {/* Lazy-loaded recharts visualizations */}
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <StatsCharts
              chartData={chartData}
              chartTitle={chartTitle}
              analytics={analytics}
              totalClicks={totalClicks}
            />
          </Suspense>
        </div>
      </div>
    </motion.div>
  );
}
