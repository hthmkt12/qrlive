import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry error tracking and performance monitoring.
 * No-ops when VITE_SENTRY_DSN is not set (dev/test environments).
 * Set VITE_SENTRY_DSN in Vercel environment variables for production.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllInputs: true, blockAllMedia: false }),
    ],
    // Lower sample rate in production to control volume/cost
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Re-export for use in App.tsx
// Note: @sentry/vite-plugin for source maps can be added to vite.config.ts later
// via: import sentryVitePlugin from "@sentry/vite-plugin" and added to plugins[]
export const SentryErrorBoundary = Sentry.ErrorBoundary;
