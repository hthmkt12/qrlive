import { useState, useMemo, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { QrCode, Globe, BarChart3, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateLinkDialog } from "@/components/CreateLinkDialog";
import { LinkCard } from "@/components/LinkCard";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { BulkExportButton } from "@/components/bulk-export-button";
// Lazy-load StatsPanel (pulls in Recharts ~80KB) — only loaded when user opens analytics view
const StatsPanel = lazy(() => import("@/components/StatsPanel").then((m) => ({ default: m.StatsPanel })));
import { EditLinkDialog } from "@/components/EditLinkDialog";
import { LinkAnalyticsDetailRow, QRLinkRow } from "@/lib/db";
import { useLinkAnalyticsDetail, useLinkAnalyticsSummaries, useLinks } from "@/hooks/use-links";

const EMPTY_ANALYTICS_DETAIL: LinkAnalyticsDetailRow = {
  link_id: "",
  total_clicks: 0,
  today_clicks: 0,
  countries_count: 0,
  clicks_by_day: [],
  country_breakdown: [],
  referer_breakdown: [],
};

const Index = () => {
  const [selectedLink, setSelectedLink] = useState<QRLinkRow | null>(null);
  const [editingLink, setEditingLink] = useState<QRLinkRow | null>(null);
  const { data: links = [], isLoading } = useLinks();
  const selectedLinkId = selectedLink?.id ?? null;
  const linkIds = links.map((link) => link.id);
  const { data: analyticsSummaries = [], isLoading: analyticsLoading } = useLinkAnalyticsSummaries(linkIds);
  const { data: selectedAnalytics, isLoading: statsLoading } = useLinkAnalyticsDetail(selectedLinkId);
  const analyticsByLinkId = useMemo(
    () => new Map(analyticsSummaries.map((summary) => [summary.link_id, summary])),
    [analyticsSummaries]
  );

  // Show stats panel for the selected link (kept fresh from query cache)
  if (selectedLink) {
    const freshLink = links.find((l) => l.id === selectedLink.id);
    if (freshLink) {
      return (
        <div className="min-h-screen bg-background p-6 md:p-10">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
            <StatsPanel
              link={freshLink}
              analytics={selectedAnalytics ?? EMPTY_ANALYTICS_DETAIL}
              isLoading={statsLoading}
              onBack={() => setSelectedLink(null)}
            />
          </Suspense>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <div className="container mx-auto px-6 py-8">
        <DashboardMetrics
          links={links}
          analyticsSummaries={analyticsSummaries}
          analyticsLoading={analyticsLoading}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="hidden sm:block rounded-xl border border-border bg-card p-6 mb-8"
        >
          <div className="flex flex-wrap gap-6 justify-center text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> QR luôn sống - thay đổi link bất cứ lúc nào
            </span>
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> Bọc link vượt geo-block
            </span>
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Thống kê traffic real-time
            </span>
          </div>
        </motion.div>

        {/* Bulk import/export toolbar — shown only when there are links or while loading */}
        {!isLoading && (
          <div className="flex items-center justify-end gap-2 mb-4">
            <BulkImportDialog />
            <BulkExportButton links={links} />
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5">
                <div className="flex gap-4">
                  <Skeleton className="h-[80px] w-[80px] rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </div>
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-20">
            <QrCode className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-1">Chưa có QR code nào</p>
            <p className="text-muted-foreground mb-6">Tạo QR đầu tiên để bắt đầu theo dõi traffic</p>
            <CreateLinkDialog />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {links.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                analytics={analyticsByLinkId.get(link.id)}
                analyticsLoading={analyticsLoading}
                onSelect={setSelectedLink}
                onEdit={setEditingLink}
              />
            ))}
          </div>
        )}
      </div>

      <EditLinkDialog
        link={editingLink}
        open={!!editingLink}
        onOpenChange={(open) => !open && setEditingLink(null)}
      />
    </div>
  );
};

export default Index;
