import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Save } from "lucide-react";
import { LinkGeoRoutesFields } from "@/components/link-geo-routes-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateGeoRoutes, useUpdateLink } from "@/hooks/use-link-mutations";
import { useToast } from "@/hooks/use-toast";
import type { QRLinkRow } from "@/lib/db";
import type { QrConfig } from "@/lib/db/models";
import { type LinkFormInput, linkFormSchema } from "@/lib/schemas";

interface EditLinkDialogProps {
  link: QRLinkRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM: LinkFormInput = {
  name: "",
  defaultUrl: "",
  geoRoutes: [],
  customShortCode: "",
  expiresAt: "",
  linkPassword: undefined,
  webhookUrl: "",
};

export function EditLinkDialog({ link, open, onOpenChange }: EditLinkDialogProps) {
  const [clearPassword, setClearPassword] = useState(false);
  const qrConfigRef = useRef<QrConfig | null>(null);
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
    defaultValues: EMPTY_FORM,
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
      webhookUrl: link.webhook_url || "",
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

  const onSubmit = async (data: LinkFormInput) => {
    try {
      const expiresAt = data.expiresAt ? new Date(`${data.expiresAt}T23:59:59`).toISOString() : null;
      const nextPassword = data.linkPassword?.trim() ?? "";
      await updateLink.mutateAsync({
        id: link.id,
        updates: {
          name: data.name,
          default_url: data.defaultUrl,
          webhook_url: data.webhookUrl || null,
          expires_at: expiresAt,
          qr_config: qrConfigRef.current,
        },
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
      toast({
        title: "Lỗi cập nhật",
        description: description || "Vui lòng thử lại",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl">Chỉnh sửa link</DialogTitle>
          <DialogDescription>Cập nhật thông tin, mật khẩu, webhook hoặc chuyển hướng theo quốc gia.</DialogDescription>
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
            <Label>
              Ngày hết hạn <span className="text-xs font-normal text-muted-foreground">(tùy chọn)</span>
            </Label>
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

          <div className="space-y-1">
            <Label>
              Webhook nhận click <span className="text-xs font-normal text-muted-foreground">(tùy chọn)</span>
            </Label>
            <Input placeholder="https://example.com/webhooks/qrlive" {...register("webhookUrl")} />
            <p className="text-xs text-muted-foreground">
              Để trống nếu muốn tắt thông báo. QRLive chỉ gửi khi click hợp lệ được lưu vào analytics.
            </p>
            {errors.webhookUrl && <p className="text-xs text-destructive">{errors.webhookUrl.message}</p>}
          </div>

          <LinkGeoRoutesFields
            append={append}
            errors={errors}
            fields={fields}
            emptyMessage="Thêm rule để chuyển hướng người dùng theo IP/quốc gia."
            register={register}
            remove={remove}
            setValue={setValue}
            watch={watch}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full font-semibold gradient-primary">
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
