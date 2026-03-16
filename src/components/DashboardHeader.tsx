import { QrCode, LogOut, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateLinkDialog } from "@/components/CreateLinkDialog";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";

/** Top navigation header with logo, user email, theme toggle, logout, and create button */
export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      toast({ title: "Lỗi đăng xuất", variant: "destructive" });
    }
  };

  return (
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
  );
}
