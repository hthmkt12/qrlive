import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { BarChart3, Trash2, Edit, ToggleLeft, ToggleRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { COUNTRIES } from "@/lib/types";
import { getRedirectUrl, LinkAnalyticsSummaryRow, QRLinkRow } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useDeleteLink, useToggleActive } from "@/hooks/use-link-mutations";

interface LinkCardProps {
  link: QRLinkRow;
  analytics?: LinkAnalyticsSummaryRow;
  analyticsLoading?: boolean;
  onSelect: (link: QRLinkRow) => void;
  onEdit: (link: QRLinkRow) => void;
}

export function LinkCard({ link, analytics, analyticsLoading = false, onSelect, onEdit }: LinkCardProps) {
  const { toast } = useToast();
  const wrapperUrl = getRedirectUrl(link.short_code);
  const deleteLink = useDeleteLink();
  const toggleActive = useToggleActive();

  const handleDelete = async () => {
    try {
      await deleteLink.mutateAsync(link.id);
      toast({ title: "Đã xóa link" });
    } catch {
      toast({ title: "Lỗi xóa link", variant: "destructive" });
    }
  };

  const handleToggle = () => {
    toggleActive.mutate({ id: link.id, isActive: !link.is_active });
  };

  const totalClicks = analytics?.total_clicks ?? 0;
  const todayClicks = analytics?.today_clicks ?? 0;
  const topCountryInfo = analytics?.top_country_code
    ? COUNTRIES.find((c) => c.code === analytics.top_country_code)
    : null;

  // Expiration badge state
  const now = new Date();
  const expiresDate = link.expires_at ? new Date(link.expires_at) : null;
  const isExpired = expiresDate ? expiresDate <= now : false;
  const expiresLabel = expiresDate
    ? isExpired
      ? "Đã hết hạn"
      : `Hết hạn: ${expiresDate.toLocaleDateString("vi-VN")}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-card p-5 transition-all hover:glow-primary hover:glow-border ${
        !link.is_active ? "opacity-50" : ""
      }`}
    >
      <div className="flex gap-4">
        <div className="flex-shrink-0 rounded-lg border border-border bg-secondary/50 p-2">
          <QRCodeSVG
            value={wrapperUrl}
            size={64}
            bgColor="transparent"
            fgColor="hsl(174, 72%, 50%)"
            level="L"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-1.5">
                {link.name}
                {link.has_password && (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" title="Link được bảo vệ bằng mật khẩu" />
                )}
              </h3>
              <p className="font-mono text-xs text-primary truncate">{wrapperUrl}</p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleToggle}
                disabled={toggleActive.isPending}
              >
                {link.is_active ? (
                  <ToggleRight className="h-4 w-4 text-success" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={deleteLink.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xóa QR link này?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tất cả dữ liệu click sẽ bị mất vĩnh viễn. Hành động này không thể hoàn tác.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                      Xóa
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-1 truncate">→ {link.default_url}</p>

          {expiresLabel && (
            <span
              className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                isExpired
                  ? "bg-destructive/20 text-destructive"
                  : "bg-warning/20 text-warning"
              }`}
            >
              {expiresLabel}
            </span>
          )}

          {link.geo_routes?.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {link.geo_routes.map((r) => {
                const c = COUNTRIES.find((c) => c.code === r.country_code);
                return (
                  <span
                    key={r.id ?? r.country_code}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                    title={r.bypass_url ? `Bypass: ${r.bypass_url}` : undefined}
                  >
                    {c?.flag} {r.country_code}
                    {r.bypass_url && (
                      <span className="text-warning font-bold" title="Có bypass URL">↺</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              {analyticsLoading ? "..." : `${totalClicks} clicks`}
            </span>
            <span>Hôm nay: {todayClicks}</span>
            {topCountryInfo && (
              <span>
                Top: {topCountryInfo.flag} {topCountryInfo.code}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onSelect(link)}>
          <BarChart3 className="h-3 w-3 mr-1" /> Thống kê
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(link)}>
          <Edit className="h-3 w-3 mr-1" /> Chỉnh sửa
        </Button>
      </div>
    </motion.div>
  );
}
