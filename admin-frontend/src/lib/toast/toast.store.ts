import { create } from "zustand";

export type ToastVariant = "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
};

type ToastInput = Omit<Toast, "id" | "duration"> & { duration?: number };

type ToastState = {
  toasts: Toast[];
};

type ToastActions = {
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  error: 7000,
  warning: 6000,
  info: 5000 };

export const useToastStore = create<ToastState & ToastActions>((set) => ({
  toasts: [],

  push: (input) => {
    const id = crypto.randomUUID();
    const duration = input.duration ?? DEFAULT_DURATION[input.variant];
    set((s) => ({
      // Cap at 5 visible toasts; drop the oldest when over limit
      toasts: [...s.toasts.slice(-4), { ...input, id, duration }] }));
    if (duration > 0) {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  dismissAll: () => set({ toasts: [] }) }));

/**
 * Imperative helper — safe to call outside React components (e.g. in mutation
 * callbacks, API error handlers, or store actions).
 */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: "success", title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: "error", title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: "warning", title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ variant: "info", title, description }) };
