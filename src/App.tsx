import { lazy, ReactNode, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { initSentry, SentryErrorBoundary } from "@/lib/sentry-config";

// Initialize Sentry at module load time (no-ops when VITE_SENTRY_DSN is unset)
initSentry();

// Route-level lazy loading — each page becomes its own chunk
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

/** Redirects unauthenticated users to /auth; renders nothing while loading */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/** Fallback UI shown when an unhandled React error is caught by Sentry ErrorBoundary */
function ErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-destructive">Đã xảy ra lỗi</h1>
        <p className="text-muted-foreground">Ứng dụng gặp sự cố. Vui lòng thử lại.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Tải lại trang
        </button>
      </div>
    </div>
  );
}

const App = () => (
  <SentryErrorBoundary fallback={<ErrorFallback />}>
    <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </SentryErrorBoundary>
);

export default App;
