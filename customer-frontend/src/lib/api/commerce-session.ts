const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const SESSION_STORAGE_KEY = "customer-commerce-x-session-id";
const ACCESS_TOKEN_KEY = "customer-commerce-access-token";
const REFRESH_TOKEN_KEY = "customer-commerce-refresh-token";

const readStorage = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
};

export const getOrCreateSessionId = (): string => {
  const storage = readStorage();
  if (!storage) {
    return newId();
  }
  const existing = storage.getItem(SESSION_STORAGE_KEY)?.trim();
  if (existing && existing.length >= 8) {
    return existing;
  }
  const next = newId();
  storage.setItem(SESSION_STORAGE_KEY, next);
  return next;
};

export const getSessionId = (): string | null => readStorage()?.getItem(SESSION_STORAGE_KEY)?.trim() ?? null;

export const getAccessToken = (): string | null => readStorage()?.getItem(ACCESS_TOKEN_KEY)?.trim() ?? null;

export const getRefreshToken = (): string | null => readStorage()?.getItem(REFRESH_TOKEN_KEY)?.trim() ?? null;

export const setAuthTokens = (accessToken: string | null, refreshToken: string | null) => {
  const storage = readStorage();
  if (!storage) {
    return;
  }
  if (accessToken) {
    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    storage.removeItem(ACCESS_TOKEN_KEY);
  }
  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    storage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const clearAuthTokens = () => {
  const storage = readStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
};

export const clearCommerceSession = () => {
  const storage = readStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(SESSION_STORAGE_KEY);
};
