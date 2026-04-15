import { create } from "zustand";
import { persist } from "zustand/middleware";

import { clearAuthTokens, clearCommerceSession, getAccessToken, setAuthTokens } from "@/lib/api/commerce-session";

const MAX_RECENT = 16;

interface CustomerStore {
  wishlist: string[];
  recentlyViewedProductSlugs: string[];
  isAuthenticated: boolean;

  hydrateAuth: () => void;
  setAuthenticatedSession: (accessToken: string, refreshToken: string) => void;
  signOut: () => void;

  toggleWishlist: (productId: string) => void;
  addRecentlyViewed: (productSlug: string) => void;
  clearRecentlyViewed: () => void;
}

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set) => ({
      wishlist: [],
      recentlyViewedProductSlugs: [],
      isAuthenticated: Boolean(typeof window !== "undefined" && getAccessToken()),

      hydrateAuth: () => set({ isAuthenticated: Boolean(getAccessToken()) }),

      setAuthenticatedSession: (accessToken, refreshToken) => {
        setAuthTokens(accessToken, refreshToken);
        set({ isAuthenticated: true });
      },

      signOut: () => {
        clearAuthTokens();
        clearCommerceSession();
        set({ isAuthenticated: false, wishlist: [] });
      },

      toggleWishlist: (productId) =>
        set((state) => ({
          wishlist: state.wishlist.includes(productId)
            ? state.wishlist.filter((id) => id !== productId)
            : [...state.wishlist, productId],
        })),

      addRecentlyViewed: (productSlug) =>
        set((state) => {
          const next = [productSlug, ...state.recentlyViewedProductSlugs.filter((s) => s !== productSlug)];
          return { recentlyViewedProductSlugs: next.slice(0, MAX_RECENT) };
        }),

      clearRecentlyViewed: () => set({ recentlyViewedProductSlugs: [] }),
    }),
    {
      name: "atelier-customer-store",
      partialize: (state) => ({
        wishlist: state.wishlist,
        recentlyViewedProductSlugs: state.recentlyViewedProductSlugs,
      }),
    }
  )
);
