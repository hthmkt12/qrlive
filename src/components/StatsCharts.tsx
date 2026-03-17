import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { LinkAnalyticsDetailRow } from "@/lib/db";
import { COUNTRIES } from "@/lib/types";

/** Resolve a country code to display label, or null for "all" */
function countryLabel(code: string): string | null {
  if (code === "all") return null;
  const c = COUNTRIES.find((c) => c.code === code);
  return c ? `${c.flag} ${c.name}` : code;
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

export interface StatsChartsProps {
  chartData: { date: string; clicks: number }[];
  chartTitle: string;
  analytics: LinkAnalyticsDetailRow;
  totalClicks: number;
  selectedCountry?: string; // "all" or a country code — used for section heading
}

/** Recharts-heavy visualizations — bar chart, country pie, referer breakdown */
export default function StatsCharts({ chartData, chartTitle, analytics, totalClicks, selectedCountry = "all" }: StatsChartsProps) {
  const activeCountryLabel = countryLabel(selectedCountry);

  const countryData = analytics.country_breakdown.map((entry) => {
    const country = COUNTRIES.find((item) => item.code === entry.country_code);
    return { name: country ? `${country.flag} ${country.code}` : entry.country_code, value: entry.clicks };
  });

  const refererData = analytics.referer_breakdown.map((entry) => ({
    name: entry.referer || "direct",
    value: entry.clicks,
  }));

  return (
    <>
      {/* Bar chart — filtered by date range */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="mb-4 text-sm font-semibold">{chartTitle}</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
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

      {/* Country + referer breakdowns — filtered by date range */}
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
          <div className="mb-4 flex items-center gap-2">
            <h4 className="text-sm font-semibold">Nguồn truy cập</h4>
            {activeCountryLabel && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                {activeCountryLabel}
              </span>
            )}
          </div>
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
    </>
  );
}
