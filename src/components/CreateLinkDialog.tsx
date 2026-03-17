import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Plus } from "lucide-react";
import { LinkGeoRoutesFields } from "@/components/link-geo-routes-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { useCreateLink } from "@/hooks/use-link-mutations";
import { useToast } from "@/hooks/use-toast";
import type { QrConfig } from "@/lib/db/models";
import { type LinkFormInput, linkFormSchema } from "@/lib/schemas";

const DEFAULT_VALUES: LinkFormInput = {
  name: "",
  defaultUrl: "",
  geoRoutes: [],
  customShortCode: "",
  expiresAt: "",
  linkPassword: "",
  webhookUrl: "",
};

export function CreateLinkDialog() {
  const [open, setOpen] = useState(false);
  const qrConfigRef = useRef<QrConfig | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const createLink = useCreateLink();
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
    defaultValues: DEFAULT_VALUES,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "geoRoutes" });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      reset(DEFAULT_VALUES);
      qrConfigRef.current = null;
    }
  };

  const onSubmit = async (data: LinkFormInput) => {
    if (!user) {
      toast({ title: "Vui lòng đăng nhập trước", variant: "destructive" });
      return;
    }

    try {
      const expiresAt = data.expiresAt ? new Date(`${data.expiresAt}T23:59:59`).toISOString() : null;
      await createLink.mutateAsync({
        name: data.name,
        defaultUrl: data.defaultUrl,
        geoRoutes: data.geoRoutes.map((route) => ({
          country: route.country,
          countryCode: route.countryCode,
          targetUrl: route.targetUrl,
          bypassUrl: route.bypassUrl || undefined,
        })),
        userId: user.id,
        customShortCode: data.customShortCode || undefined,
        expiresAt,
        password: data.linkPassword || undefined,
        qrConfig: qrConfigRef.current,
        webhookUrl: data.webhookUrl || undefined,
      });
      handleOpenChange(false);
      toast({ title: "Đã tạo link thành công! 🎉" });
    } catch (error) {
      const message =
        error instanceof Error && error.message === "SHORT_CODE_TAKEN"
          ? "Short code này đã được dùng, vui lòng chọn cái khác"
          : error instanceof Error && error.message === "INVALID_SHORT_CODE_FORMAT"
            ? "Short code chỉ được chứa chữ cái, số, dấu gạch ngang (-) và gạch dưới (_), dài 3-20 ký tự"
            : "Lỗi tạo link";
      toast({ title: message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gradient-primary font-semibold">
          <Plus className="mr-2 h-4 w-4" />
          Tạo QR mới
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl">Tạo link QR mới</DialogTitle>
          <DialogDescription>Điền thông tin để tạo link rút gọn kèm mã QR.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div className="space-y-1">
            <Label>Tên link</Label>
            <Input placeholder="Ví dụ: Netflix US" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>URL mặc định</Label>
            <Input placeholder="https://example.com" {...register("defaultUrl")} />
            {errors.defaultUrl && <p className="text-xs text-destructive">{errors.defaultUrl.message}</p>}
          </div>

          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              Short code
              <span className="text-xs font-normal text-muted-foreground">(tùy chọn - để trống để tự tạo)</span>
            </Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">/r/</span>
              <Input placeholder="vi-du-cua-toi" {...register("customShortCode")} className="font-mono" />
            </div>
            {errors.customShortCode && <p className="text-xs text-destructive">{errors.customShortCode.message}</p>}
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
            <Input type="password" placeholder="Để trống nếu không cần mật khẩu" {...register("linkPassword")} />
            {errors.linkPassword && <p className="text-xs text-destructive">{errors.linkPassword.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>
              Webhook nhận click <span className="text-xs font-normal text-muted-foreground">(tùy chọn)</span>
            </Label>
            <Input placeholder="https://example.com/webhooks/qrlive" {...register("webhookUrl")} />
            <p className="text-xs text-muted-foreground">
              QRLive sẽ gửi POST khi click hợp lệ được ghi nhận, không gửi cho bot hoặc click trùng trong 60 giây.
            </p>
            {errors.webhookUrl && <p className="text-xs text-destructive">{errors.webhookUrl.message}</p>}
          </div>

          <LinkGeoRoutesFields
            append={append}
            errors={errors}
            fields={fields}
            emptyMessage="Thêm rule để chuyển hướng người dùng theo IP/quốc gia, giúp vượt geo-block."
            register={register}
            remove={remove}
            setValue={setValue}
            watch={watch}
          />

          <Button type="submit" disabled={isSubmitting} className="w-full gradient-primary font-semibold">
            {isSubmitting ? "Đang tạo..." : "Tạo link & QR Code"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
