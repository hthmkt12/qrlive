import { motion } from "framer-motion";
import { QrCode, BarChart3, Globe, Zap } from "lucide-react";
import { QRLinkRow, LinkAnalyticsSummaryRow } from "@/lib/db";

interface DashboardMetricsProps {
  links: QRLinkRow[];
  analyticsSummaries: LinkAnalyticsSummaryRow[];
  analyticsLoading: boolean;
}

/** Dashboard summary cards — QR count, total clicks, geo routes, active links */
export function DashboardMetrics({ links, analyticsSummaries, analyticsLoading }: DashboardMetricsProps) {
  const totalClicks = analyticsSummaries.reduce((sum, s) => sum + s.total_clicks, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
    >
      <div className="rounded-xl border border-border bg-card p-4">
        <QrCode className="h-5 w-5 text-primary mb-2" />
        <p className="text-2xl font-bold">{links.length}</p>
        <p className="text-xs text-muted-foreground">QR Codes</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <BarChart3 className="h-5 w-5 text-success mb-2" />
        <p className="text-2xl font-bold">{analyticsLoading && links.length > 0 ? "..." : totalClicks}</p>
        <p className="text-xs text-muted-foreground">Tổng clicks</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Globe className="h-5 w-5 text-warning mb-2" />
        <p className="text-2xl font-bold">
          {links.reduce((sum, l) => sum + (l.geo_routes?.length || 0), 0)}
        </p>
        <p className="text-xs text-muted-foreground">Geo Routes</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Zap className="h-5 w-5 text-primary animate-pulse-glow mb-2" />
        <p className="text-2xl font-bold">{links.filter((l) => l.is_active).length}</p>
        <p className="text-xs text-muted-foreground">Đang hoạt động</p>
      </div>
    </motion.div>
  );
}
