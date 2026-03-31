/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV_LABEL?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  readonly VITE_BACKEND_BASE_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  readonly VITE_APP_RELEASE?: string;
  readonly VITE_STITCH_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
