const readTrimmed = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const readNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const customerFrontendEnv = {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  backendBaseUrl: readTrimmed(import.meta.env.VITE_BACKEND_BASE_URL),
  sentryDsn: readTrimmed(import.meta.env.VITE_SENTRY_DSN),
  sentryEnableInDev: readTrimmed(import.meta.env.VITE_SENTRY_ENABLE_IN_DEV) === "true",
  sentryTracesSampleRate: readNumber(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0),
  appRelease: readTrimmed(import.meta.env.VITE_APP_RELEASE)
} as const;
