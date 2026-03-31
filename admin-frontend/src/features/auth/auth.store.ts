import { create } from "zustand";

export type AdminActor = {
  id: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
  permissions: string[];
};

type AdminSessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  actor: AdminActor | null;
  hydrated: boolean;
  remembered: boolean;
  setSession: (input: {
    accessToken: string;
    refreshToken: string;
    actor?: AdminActor | null;
    remember?: boolean;
  }) => void;
  setActor: (actor: AdminActor | null) => void;
  clearSession: () => void;
  hydrate: () => void;
};

const persistentStorageKey = "ecommerce-admin-auth-persistent";
const sessionStorageKey = "ecommerce-admin-auth-session";

const readStoredState = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const read = (storage: Storage, remembered: boolean) => {
    const raw = storage.getItem(remembered ? persistentStorageKey : sessionStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return {
        remembered,
        ...(JSON.parse(raw) as Pick<AdminSessionState, "accessToken" | "refreshToken" | "actor">)
      };
    } catch {
      return null;
    }
  };

  return read(window.sessionStorage, false) ?? read(window.localStorage, true);
};

const writeStoredState = (
  state: Pick<AdminSessionState, "accessToken" | "refreshToken" | "actor"> & { remembered: boolean }
) => {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify({
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    actor: state.actor
  });

  if (state.remembered) {
    window.localStorage.setItem(persistentStorageKey, payload);
    window.sessionStorage.removeItem(sessionStorageKey);
    return;
  }

  window.sessionStorage.setItem(sessionStorageKey, payload);
  window.localStorage.removeItem(persistentStorageKey);
};

const clearStoredState = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(persistentStorageKey);
  window.sessionStorage.removeItem(sessionStorageKey);
};

export const useAdminAuthStore = create<AdminSessionState>((set) => ({
  accessToken: null,
  refreshToken: null,
  actor: null,
  hydrated: false,
  remembered: false,
  setSession: ({ accessToken, refreshToken, actor = null, remember }) => {
    set((state) => {
      const remembered = remember ?? state.remembered;
      writeStoredState({ accessToken, refreshToken, actor, remembered });
      return { accessToken, refreshToken, actor, remembered };
    });
  },
  setActor: (actor) => {
    set((state) => {
      writeStoredState({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        actor,
        remembered: state.remembered
      });

      return { actor };
    });
  },
  clearSession: () => {
    clearStoredState();
    set({ accessToken: null, refreshToken: null, actor: null, remembered: false });
  },
  hydrate: () => {
    const stored = readStoredState();
    set({
      accessToken: stored?.accessToken ?? null,
      refreshToken: stored?.refreshToken ?? null,
      actor: stored?.actor ?? null,
      remembered: stored?.remembered ?? false,
      hydrated: true
    });
  }
}));
