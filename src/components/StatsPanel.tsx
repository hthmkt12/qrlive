import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ArrowLeft, Globe, MousePointerClick, TrendingUp } from "lucide-react";
import { COUNTRIES } from "@/lib/types";
import { LinkAnalyticsDetailRow, QRLinkRow } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { QRPreview } from "./QRPreview";

interface StatsPanelProps {
  link: QRLinkRow;
  analytics: LinkAnalyticsDetailRow;
  isLoading?: boolean;
  onBack: () => void;
}

const CHART_COLORS = [
  "hsl(174, 72%, 50%)",
  "hsl(174, 60%, 40%)",
  "hsl(150, 60%, 45%)",
  "hsl(38, 90%, 55%)",
  "hsl(0, 72%, 55%)",
  "hsl(220, 60%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(320, 60%, 50%)",
];

function formatDayLabel(date: string) {
  // Use UTC noon to avoid date shift from DST or timezone offset
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "numeric",
  });
}

export function StatsPanel({ link, analytics, isLoading = false, onBack }: StatsPanelProps) {
  const clicksByDay = analytics.clicks_by_day.map((entry) => ({
    date: formatDayLabel(entry.date),
    clicks: entry.clicks,
  }));

  const countryData = analytics.country_breakdown.map((entry) => {
    const country = COUNTRIES.find((item) => item.code === entry.country_code);
    return {
      name: country ? `${country.flag} ${country.code}` : entry.country_code,
      value: entry.clicks,
    };
  });

  const refererData = analytics.referer_breakdown.map((entry) => ({
    name: entry.referer || "direct",
    value: entry.clicks,
  }));

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

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-4 text-sm font-semibold">Clicks 7 ngày qua</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={clicksByDay}>
                <XAxis dataKey="date" tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(215, 12%, 50%)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220, 18%, 10%)",
                    border: "1px solid hsl(220, 14%, 18%)",
                    borderRadius: "8px",
                    color: "hsl(210, 20%, 92%)",
                  }}
                />
                <Bar dataKey="clicks" fill="hsl(174, 72%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="mb-4 text-sm font-semibold">Theo quốc gia</h4>
              {countryData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={countryData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                        {countryData.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {countryData.slice(0, 5).map((entry, index) => (
                      <span key={index} className="text-xs text-muted-foreground">
                        {entry.name}: {entry.value}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="mb-4 text-sm font-semibold">Nguồn truy cập</h4>
              {refererData.length > 0 ? (
                <div className="space-y-2">
                  {refererData.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-mono">{entry.name}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.max(8, (entry.value / Math.max(totalClicks, 1)) * 100)}px`,
                            background: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        <span className="text-xs text-muted-foreground">{entry.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
