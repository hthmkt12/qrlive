import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      // React app tests (jsdom environment)
      {
        extends: true,
        test: {
          name: "app",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      // Cloudflare Worker tests (node environment)
      {
        test: {
          name: "cloudflare-worker",
          include: ["cloudflare-worker/**/*.test.{js,ts}"],
          environment: "node",
          globals: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**",
        "src/hooks/**",
        "src/contexts/**",
        "src/components/**",
        "src/pages/**",
        "supabase/functions/_shared/**",
        "supabase/functions/link-cache-invalidate/link-cache-invalidate-handler.ts",
        "supabase/functions/redirect/click-webhook.ts",
        "supabase/functions/redirect/redirect-handler.ts",
        "supabase/functions/redirect/redirect-link-cache.ts",
        "supabase/functions/redirect/redirect-password.ts",
        "cloudflare-worker/redirect-proxy.js",
      ],
      exclude: [
        "src/components/ui/**",
        "src/test/**",
        "src/integrations/**",
        "src/hooks/use-toast.ts",
        "src/hooks/use-mobile.tsx",
        "src/vite-env.d.ts",
        "src/main.tsx",
        "supabase/functions/**/index.ts",
        "supabase/functions/proxy/**",
      ],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
