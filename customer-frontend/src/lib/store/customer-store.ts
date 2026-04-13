import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
  name: string;
  imageUrl: string;
}

const MAX_RECENT = 16;
const normalizeQuantity = (quantity: number) => Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));

interface CustomerStore {
  cart: CartItem[];
  wishlist: string[];
  recentlyViewedProductSlugs: string[];
  isAuthenticated: boolean;

  addToCart: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  addRecentlyViewed: (productSlug: string) => void;
  clearRecentlyViewed: () => void;
  signIn: () => void;
  signOut: () => void;
}

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set) => ({
      cart: [],
      wishlist: [],
      recentlyViewedProductSlugs: [],
      isAuthenticated: false,

      addToCart: (item) =>
        set((state) => {
          const quantityToAdd = normalizeQuantity(item.quantity);
          if (quantityToAdd <= 0) {
            return state;
          }

          const existing = state.cart.find((c) => c.variantId === item.variantId);
          if (existing) {
            return {
              cart: state.cart.map((c) =>
                c.variantId === item.variantId ? { ...c, quantity: c.quantity + quantityToAdd } : c
              ),
            };
          }
          return { cart: [...state.cart, { ...item, quantity: quantityToAdd }] };
        }),

      updateQuantity: (variantId, quantity) =>
        set((state) => {
          const normalizedQuantity = normalizeQuantity(quantity);
          return {
            cart:
              normalizedQuantity <= 0
                ? state.cart.filter((c) => c.variantId !== variantId)
                : state.cart.map((c) => (c.variantId === variantId ? { ...c, quantity: normalizedQuantity } : c)),
          };
        }),

      clearCart: () => set({ cart: [] }),

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

      signIn: () => set({ isAuthenticated: true }),
      signOut: () => set({ isAuthenticated: false }),
    }),
    { name: "atelier-customer-store" }
  )
);
