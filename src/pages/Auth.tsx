import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { authSchema, AuthInput } from "@/lib/schemas";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [serverError, setServerError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthInput>({ resolver: zodResolver(authSchema) });

  const onSubmit = async (data: AuthInput) => {
    setServerError(null);
    try {
      if (mode === "login") {
        await signIn(data.email, data.password);
      } else {
        await signUp(data.email, data.password);
      }
      navigate("/");
    } catch (e: unknown) {
      // Normalize auth errors to prevent user enumeration via specific Supabase messages
      const raw = e instanceof Error ? e.message : "";
      const msg = raw.includes("Invalid login credentials")
        ? "Email hoặc mật khẩu không đúng"
        : raw.includes("User already registered")
          ? "Email này đã được đăng ký"
          : "Đã có lỗi xảy ra. Vui lòng thử lại";
      setServerError(msg);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setServerError(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-lg gradient-primary p-3 mb-3">
            <QrCode className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">
            QR<span className="text-gradient">Live</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === "login" ? "Đăng nhập vào tài khoản" : "Tạo tài khoản mới"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? "Đang xử lý..."
              : mode === "login"
              ? "Đăng nhập"
              : "Đăng ký"}
          </Button>
        </form>

        {/* Switch mode */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button
            type="button"
            onClick={switchMode}
            className="text-primary hover:underline"
          >
            {mode === "login" ? "Đăng ký" : "Đăng nhập"}
          </button>
        </p>
      </div>
    </div>
  );
}
