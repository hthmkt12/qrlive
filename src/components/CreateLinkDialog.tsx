import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Globe, Trash2 } from "lucide-react";
import { COUNTRIES } from "@/lib/types";
import { linkFormSchema, LinkFormInput } from "@/lib/schemas";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useCreateLink } from "@/hooks/use-link-mutations";

export function CreateLinkDialog() {
  const [open, setOpen] = useState(false);
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
    defaultValues: { name: "", defaultUrl: "", geoRoutes: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "geoRoutes" });

  const handleCountryChange = (index: number, code: string) => {
    const country = COUNTRIES.find((c) => c.code === code);
    setValue(`geoRoutes.${index}.countryCode`, code);
    setValue(`geoRoutes.${index}.country`, country?.name || "");
  };

  const onSubmit = async (data: LinkFormInput) => {
    if (!user) {
      toast({ title: "Vui lòng đăng nhập trước", variant: "destructive" });
      return;
    }
    try {
      await createLink.mutateAsync({
        name: data.name,
        defaultUrl: data.defaultUrl,
        geoRoutes: data.geoRoutes.map((r) => ({
          country: r.country,
          countryCode: r.countryCode,
          targetUrl: r.targetUrl,
          bypassUrl: r.bypassUrl || undefined,
        })),
        userId: user.id,
      });
      reset();
      setOpen(false);
      toast({ title: "Đã tạo link thành công! 🎉" });
    } catch {
      toast({ title: "Lỗi tạo link", variant: "destructive" });
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gradient-primary font-semibold">
          <Plus className="h-4 w-4 mr-2" />
          Tạo QR mới
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">Tạo link QR mới</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* Name */}
          <div className="space-y-1">
            <Label>Tên link</Label>
            <Input placeholder="Ví dụ: Netflix US" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Default URL */}
          <div className="space-y-1">
            <Label>URL mặc định</Label>
            <Input placeholder="https://example.com" {...register("defaultUrl")} />
            {errors.defaultUrl && <p className="text-xs text-destructive">{errors.defaultUrl.message}</p>}
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
                Thêm rule để chuyển hướng người dùng theo IP/quốc gia, giúp vượt geo-block.
              </p>
            )}

            {fields.map((field, i) => (
              <div key={field.id} className="space-y-1 mb-3 pl-0">
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
                {/* Bypass URL — shown when link is blocked in this country */}
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
            {isSubmitting ? "Đang tạo..." : "Tạo link & QR Code"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
