import { create } from "zustand";

type StepUpState = {
  isOpen: boolean;
  _resolve: ((password: string) => void) | null;
  _reject: (() => void) | null;
};

type StepUpActions = {
  /**
   * Opens the step-up dialog and returns a Promise that resolves with the
   * password the admin enters, or rejects when they cancel.
   * Designed to be called imperatively from non-React contexts (e.g. step-up.ts).
   */
  requestPassword: () => Promise<string>;
  confirm: (password: string) => void;
  cancel: () => void;
};

export const useStepUpStore = create<StepUpState & StepUpActions>((set, get) => ({
  isOpen: false,
  _resolve: null,
  _reject: null,

  requestPassword: () =>
    new Promise<string>((resolve, reject) => {
      set({ isOpen: true, _resolve: resolve, _reject: reject });
    }),

  confirm: (password: string) => {
    const { _resolve } = get();
    set({ isOpen: false, _resolve: null, _reject: null });
    _resolve?.(password);
  },

  cancel: () => {
    const { _reject } = get();
    set({ isOpen: false, _resolve: null, _reject: null });
    _reject?.();
  }
}));
