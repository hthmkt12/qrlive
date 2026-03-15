import { motion } from "framer-motion";
import { COUNTRIES } from "@/lib/types";
import { QRPreview } from "./QRPreview";
import { QRLinkRow } from "@/lib/db";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ArrowLeft, Globe, MousePointerClick, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StatsPanelProps {
  link: QRLinkRow;
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

export function StatsPanel({ link, onBack }: StatsPanelProps) {
  const clicks = link.click_events || [];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const clicksByDay = last7Days.map((day) => ({
    date: day.toLocaleDateString("vi-VN", { weekday: "short", day: "numeric" }),
    clicks: clicks.filter(
      (c) => new Date(c.created_at).toDateString() === day.toDateString()
    ).length,
  }));

  const byCountry = clicks.reduce((acc, c) => {
    if (c.country_code) acc[c.country_code] = (acc[c.country_code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const countryData = Object.entries(byCountry)
    .sort(([, a], [, b]) => b - a)
    .map(([code, count]) => {
      const c = COUNTRIES.find((c) => c.code === code);
      return { name: c ? `${c.flag} ${c.code}` : code, value: count };
    });

  const byReferer = clicks.reduce((acc, c) => {
    const ref = c.referer || "direct";
    acc[ref] = (acc[ref] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const refererData = Object.entries(byReferer)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" /> Quay lại
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <QRPreview url={link.default_url} shortCode={link.short_code} name={link.name} />

          {link.geo_routes?.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Globe className="h-4 w-4 text-primary" />
                Chuyển hướng theo quốc gia
              </h4>
              {link.geo_routes.map((r) => {
                const c = COUNTRIES.find((c) => c.code === r.country_code);
                return (
                  <div key={r.id ?? r.country_code} className="flex items-center gap-2 text-sm mb-2">
                    <span>{c?.flag}</span>
                    <span className="font-mono text-muted-foreground">{r.country_code}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-xs text-primary truncate">{r.target_url}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <MousePointerClick className="h-5 w-5 text-primary mb-2" />
              <p className="text-2xl font-bold">{clicks.length}</p>
              <p className="text-xs text-muted-foreground">Tổng clicks</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <TrendingUp className="h-5 w-5 text-success mb-2" />
              <p className="text-2xl font-bold">
                {clicks.filter((c) => new Date(c.created_at).toDateString() === new Date().toDateString()).length}
              </p>
              <p className="text-xs text-muted-foreground">Hôm nay</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Globe className="h-5 w-5 text-warning mb-2" />
              <p className="text-2xl font-bold">{Object.keys(byCountry).length}</p>
              <p className="text-xs text-muted-foreground">Quốc gia</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="text-sm font-semibold mb-4">Clicks 7 ngày qua</h4>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="text-sm font-semibold mb-4">Theo quốc gia</h4>
              {countryData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={countryData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                        {countryData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {countryData.slice(0, 5).map((d, i) => (
                      <span key={i} className="text-xs text-muted-foreground">{d.name}: {d.value}</span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="text-sm font-semibold mb-4">Nguồn truy cập</h4>
              {refererData.length > 0 ? (
                <div className="space-y-2">
                  {refererData.map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm font-mono">{r.name}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${(r.value / clicks.length) * 100}px`,
                            minWidth: "8px",
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                        <span className="text-xs text-muted-foreground">{r.value}</span>
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
