/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sentry DSN — set in Vercel environment variables for production; omit to disable Sentry */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
