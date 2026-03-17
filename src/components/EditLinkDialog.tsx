import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, Lock, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUpdateGeoRoutes, useUpdateLink } from "@/hooks/use-link-mutations";
import { QRLinkRow } from "@/lib/db";
import type { QrConfig } from "@/lib/db/models";
import { linkFormSchema, LinkFormInput } from "@/lib/schemas";
import { COUNTRIES } from "@/lib/types";

interface EditLinkDialogProps {
  link: QRLinkRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLinkDialog({ link, open, onOpenChange }: EditLinkDialogProps) {
  const { toast } = useToast();
  const updateLink = useUpdateLink();
  const updateGeoRoutes = useUpdateGeoRoutes();
  const qrConfigRef = useRef<QrConfig | null>(null);
  const [clearPassword, setClearPassword] = useState(false);
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
  const passwordField = register("linkPassword");

  useEffect(() => {
    if (!link || !open) return;
    reset({
      name: link.name,
      defaultUrl: link.default_url,
      expiresAt: link.expires_at ? link.expires_at.substring(0, 10) : "",
      linkPassword: undefined,
      geoRoutes: (link.geo_routes || []).map((route) => ({
        country: route.country,
        countryCode: route.country_code,
        targetUrl: route.target_url,
        bypassUrl: route.bypass_url || "",
      })),
    });
    qrConfigRef.current = link.qr_config ?? null;
    setClearPassword(false);
  }, [link, open, reset]);

  if (!link) return null;

  const handleCountryChange = (index: number, code: string) => {
    const country = COUNTRIES.find((item) => item.code === code);
    setValue(`geoRoutes.${index}.countryCode`, code);
    setValue(`geoRoutes.${index}.country`, country?.name || "");
  };

  const onSubmit = async (data: LinkFormInput) => {
    try {
      const expires_at = data.expiresAt ? new Date(`${data.expiresAt}T23:59:59`).toISOString() : null;
      const nextPassword = data.linkPassword?.trim() ?? "";
      await updateLink.mutateAsync({
        id: link.id,
        updates: { name: data.name, default_url: data.defaultUrl, expires_at, qr_config: qrConfigRef.current },
        password: clearPassword ? "" : nextPassword || undefined,
      });
      await updateGeoRoutes.mutateAsync({
        linkId: link.id,
        geoRoutes: data.geoRoutes.map((route) => ({
          country: route.country,
          countryCode: route.countryCode,
          targetUrl: route.targetUrl,
          bypassUrl: route.bypassUrl || undefined,
        })),
      });
      onOpenChange(false);
      toast({ title: "Đã cập nhật thành công! ✨" });
    } catch (error) {
      const description = error instanceof Error ? error.message : "";
      toast({ title: "Lỗi cập nhật", description: description || "Vui lòng thử lại", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">Chỉnh sửa link</DialogTitle>
          <DialogDescription>Cập nhật thông tin, mật khẩu hoặc chuyển hướng theo quốc gia.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div className="space-y-1">
            <Label>Tên link</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>URL mặc định</Label>
            <Input {...register("defaultUrl")} />
            {errors.defaultUrl && <p className="text-xs text-destructive">{errors.defaultUrl.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>Ngày hết hạn <span className="text-xs font-normal text-muted-foreground">(tùy chọn)</span></Label>
            <Input type="date" {...register("expiresAt")} />
          </div>

          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Mật khẩu bảo vệ
              <span className="text-xs font-normal text-muted-foreground">(tùy chọn)</span>
            </Label>
            <Input
              type="password"
              placeholder={link.has_password ? "Nhập mật khẩu mới nếu muốn thay đổi" : "Để trống nếu không cần mật khẩu"}
              {...passwordField}
              onChange={(event) => {
                setClearPassword(false);
                passwordField.onChange(event);
              }}
            />
            {link.has_password && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {clearPassword ? "Mật khẩu hiện tại sẽ được xóa khi lưu." : "Để trống nếu không muốn thay đổi mật khẩu."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClearPassword(true);
                    setValue("linkPassword", "", { shouldDirty: true, shouldTouch: true });
                  }}
                >
                  Xóa mật khẩu hiện tại
                </Button>
              </div>
            )}
            {errors.linkPassword && <p className="text-xs text-destructive">{errors.linkPassword.message}</p>}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Chuyển hướng theo quốc gia
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => append({ country: "", countryCode: "", targetUrl: "" })}>
                <Plus className="mr-1 h-3 w-3" /> Thêm
              </Button>
            </div>

            {fields.length === 0 && <p className="text-xs text-muted-foreground">Thêm rule để chuyển hướng người dùng theo IP/quốc gia.</p>}

            {fields.map((field, index) => (
              <div key={field.id} className="mb-3 space-y-1">
                <div className="flex items-center gap-2">
                  <select
                    value={watch(`geoRoutes.${index}.countryCode`)}
                    onChange={(event) => handleCountryChange(index, event.target.value)}
                    className="h-9 flex-shrink-0 rounded-md border border-border bg-secondary px-3 text-sm"
                  >
                    <option value="">Chọn quốc gia</option>
                    {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.flag} {country.name}</option>)}
                  </select>
                  <Input placeholder="URL đích" {...register(`geoRoutes.${index}.targetUrl`)} className="flex-1" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Input
                  placeholder="Bypass URL (nếu bị chặn) - ví dụ: https://translate.google.com/translate?u=..."
                  {...register(`geoRoutes.${index}.bypassUrl`)}
                  className="h-8 text-xs text-muted-foreground"
                />
                {errors.geoRoutes?.[index]?.countryCode && <p className="text-xs text-destructive">{errors.geoRoutes[index]?.countryCode?.message}</p>}
                {errors.geoRoutes?.[index]?.targetUrl && <p className="text-xs text-destructive">{errors.geoRoutes[index]?.targetUrl?.message}</p>}
                {errors.geoRoutes?.[index]?.bypassUrl && <p className="text-xs text-destructive">{errors.geoRoutes[index]?.bypassUrl?.message}</p>}
              </div>
            ))}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full font-semibold gradient-primary">
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
