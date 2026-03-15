import { useState, useMemo, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { QrCode, Zap, Globe, BarChart3, Shield, LogOut, Sun, Moon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateLinkDialog } from "@/components/CreateLinkDialog";
import { LinkCard } from "@/components/LinkCard";
// Lazy-load StatsPanel (pulls in Recharts ~80KB) — only loaded when user opens analytics view
const StatsPanel = lazy(() => import("@/components/StatsPanel").then((m) => ({ default: m.StatsPanel })));
import { EditLinkDialog } from "@/components/EditLinkDialog";
import { LinkAnalyticsDetailRow, QRLinkRow } from "@/lib/db";
import { useLinkAnalyticsDetail, useLinkAnalyticsSummaries, useLinks } from "@/hooks/use-links";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

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
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: links = [], isLoading } = useLinks();
  const selectedLinkId = selectedLink?.id ?? null;
  const linkIds = links.map((link) => link.id);
  const { data: analyticsSummaries = [], isLoading: analyticsLoading } = useLinkAnalyticsSummaries(linkIds);
  const { data: selectedAnalytics, isLoading: statsLoading } = useLinkAnalyticsDetail(selectedLinkId);
  const analyticsByLinkId = useMemo(
    () => new Map(analyticsSummaries.map((summary) => [summary.link_id, summary])),
    [analyticsSummaries]
  );

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      toast({ title: "Lỗi đăng xuất", variant: "destructive" });
    }
  };

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

  const totalClicks = analyticsSummaries.reduce((sum, summary) => sum + summary.total_clicks, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between py-4 px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg gradient-primary p-2">
              <QrCode className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">
              QR<span className="text-gradient">Live</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Đổi giao diện"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Đăng xuất">
              <LogOut className="h-4 w-4" />
            </Button>
            <CreateLinkDialog />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
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
