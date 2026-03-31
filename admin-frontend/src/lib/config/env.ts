const readTrimmed = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const readNumber = (value: string | undefined, fallback = 0) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const frontendEnv = {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  backendBaseUrl: readTrimmed(import.meta.env.VITE_BACKEND_BASE_URL),
  sentryDsn: readTrimmed(import.meta.env.VITE_SENTRY_DSN),
  sentryTracesSampleRate: readNumber(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0),
  appRelease: readTrimmed(import.meta.env.VITE_APP_RELEASE),
  appEnvLabel: readTrimmed(import.meta.env.VITE_APP_ENV_LABEL),
  stitchProjectId: readTrimmed(import.meta.env.VITE_STITCH_PROJECT_ID)
};

export const resolveFrontendEnvironmentLabel = () =>
  frontendEnv.appEnvLabel ?? (frontendEnv.isDev ? "Development" : "Production");
