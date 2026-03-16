import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Globe, Trash2, Save, Lock } from "lucide-react";
import { COUNTRIES } from "@/lib/types";
import { linkFormSchema, LinkFormInput } from "@/lib/schemas";
import { QRLinkRow } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useUpdateLink, useUpdateGeoRoutes } from "@/hooks/use-link-mutations";

interface EditLinkDialogProps {
  link: QRLinkRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLinkDialog({ link, open, onOpenChange }: EditLinkDialogProps) {
  const { toast } = useToast();
  const updateLink = useUpdateLink();
  const updateGeoRoutes = useUpdateGeoRoutes();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LinkFormInput>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: { name: "", defaultUrl: "", geoRoutes: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "geoRoutes" });

  // Populate form when a link is selected for editing
  useEffect(() => {
    if (link) {
      // Convert ISO timestamp to YYYY-MM-DD for <input type="date">
      const expiresAt = link.expires_at ? link.expires_at.substring(0, 10) : "";
      reset({
        name: link.name,
        defaultUrl: link.default_url,
        expiresAt,
        linkPassword: "",
        geoRoutes: (link.geo_routes || []).map((r) => ({
          country: r.country,
          countryCode: r.country_code,
          targetUrl: r.target_url,
          bypassUrl: r.bypass_url || "",
        })),
      });
    }
  }, [link, reset]);

  const handleCountryChange = (index: number, code: string) => {
    const country = COUNTRIES.find((c) => c.code === code);
    setValue(`geoRoutes.${index}.countryCode`, code);
    setValue(`geoRoutes.${index}.country`, country?.name || "");
  };

  const onSubmit = async (data: LinkFormInput) => {
    if (!link) return;
    try {
      // Convert YYYY-MM-DD to end-of-day ISO string, or null to clear expiration
      const expires_at = data.expiresAt ? new Date(`${data.expiresAt}T23:59:59`).toISOString() : null;
      // Pass linkPassword through: "" clears existing password; non-empty sets new; undefined = no change
      // Note: empty string is intentional — it signals "clear the password"
      await updateLink.mutateAsync({
        id: link.id,
        updates: { name: data.name, default_url: data.defaultUrl, expires_at },
        password: data.linkPassword,
      });
      await updateGeoRoutes.mutateAsync({
        linkId: link.id,
        geoRoutes: data.geoRoutes.map((r) => ({
          country: r.country,
          countryCode: r.countryCode,
          targetUrl: r.targetUrl,
          bypassUrl: r.bypassUrl || undefined,
        })),
      });
      onOpenChange(false);
      toast({ title: "Đã cập nhật thành công! ✅" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast({
        title: "Lỗi cập nhật",
        description: msg || "Vui lòng thử lại",
        variant: "destructive",
      });
    }
  };

  if (!link) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">Chỉnh sửa link</DialogTitle>
          <DialogDescription>Cập nhật thông tin, mật khẩu hoặc chuyển hướng theo quốc gia.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-1">
            <Label>Tên link</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Default URL */}
          <div className="space-y-1">
            <Label>URL mặc định</Label>
            <Input {...register("defaultUrl")} />
            {errors.defaultUrl && <p className="text-xs text-destructive">{errors.defaultUrl.message}</p>}
          </div>

          {/* Expiration date — optional */}
          <div className="space-y-1">
            <Label>Ngày hết hạn <span className="text-xs text-muted-foreground font-normal">(tùy chọn)</span></Label>
            <Input type="date" {...register("expiresAt")} />
          </div>

          {/* Password protection — optional */}
          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Mật khẩu bảo vệ
              <span className="text-xs text-muted-foreground font-normal">(tùy chọn)</span>
            </Label>
            <Input
              type="password"
              placeholder={link.has_password ? "••••••••  (nhập mật khẩu mới hoặc để trống để xóa)" : "Để trống nếu không cần mật khẩu"}
              {...register("linkPassword")}
            />
            {link.has_password && (
              <p className="text-xs text-muted-foreground">
                Link đang được bảo vệ bằng mật khẩu. Để trống để xóa mật khẩu.
              </p>
            )}
            {errors.linkPassword && (
              <p className="text-xs text-destructive">{errors.linkPassword.message}</p>
            )}
          </div>

          {/* Geo routes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Chuyển hướng theo quốc gia
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ country: "", countryCode: "", targetUrl: "" })}
              >
                <Plus className="h-3 w-3 mr-1" /> Thêm
              </Button>
            </div>

            {fields.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Thêm rule để chuyển hướng người dùng theo IP/quốc gia.
              </p>
            )}

            {fields.map((field, i) => (
              <div key={field.id} className="space-y-1 mb-3">
                <div className="flex gap-2 items-center">
                  <select
                    value={watch(`geoRoutes.${i}.countryCode`)}
                    onChange={(e) => handleCountryChange(i, e.target.value)}
                    className="h-9 rounded-md border border-border bg-secondary px-3 text-sm flex-shrink-0"
                  >
                    <option value="">Chọn quốc gia</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="URL đích"
                    {...register(`geoRoutes.${i}.targetUrl`)}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {/* Bypass URL — used when the target URL is blocked in this country */}
                <Input
                  placeholder="Bypass URL (nếu bị chặn) — ví dụ: https://translate.google.com/translate?u=..."
                  {...register(`geoRoutes.${i}.bypassUrl`)}
                  className="text-xs h-8 text-muted-foreground"
                />
                {errors.geoRoutes?.[i]?.countryCode && (
                  <p className="text-xs text-destructive">{errors.geoRoutes[i]?.countryCode?.message}</p>
                )}
                {errors.geoRoutes?.[i]?.targetUrl && (
                  <p className="text-xs text-destructive">{errors.geoRoutes[i]?.targetUrl?.message}</p>
                )}
                {errors.geoRoutes?.[i]?.bypassUrl && (
                  <p className="text-xs text-destructive">{errors.geoRoutes[i]?.bypassUrl?.message}</p>
                )}
              </div>
            ))}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full gradient-primary font-semibold">
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
