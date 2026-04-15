import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Product } from "@/lib/data/customer-mock";
import { customerBackendApi } from "@/lib/api/customer-backend-api";
import { useCustomerStore } from "@/lib/store/customer-store";

type WishlistListPayload = { items?: Array<{ id: string; product: { id: string } }> };

export function useWishlistActions() {
  const queryClient = useQueryClient();
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  const localWishlist = useCustomerStore((s) => s.wishlist);
  const toggleLocalWishlist = useCustomerStore((s) => s.toggleWishlist);

  const remoteQuery = useQuery({
    queryKey: ["customer-wishlist"],
    queryFn: async () => {
      const { data } = await customerBackendApi.listWishlist();
      return data as WishlistListPayload;
    },
    enabled: isAuthenticated,
    staleTime: 20_000
  });

  const serverItems = remoteQuery.data?.items ?? [];

  const inWishlist = (productId: string) =>
    isAuthenticated ? serverItems.some((i) => i.product.id === productId) : localWishlist.includes(productId);

  const toggle = async (product: Pick<Product, "id" | "defaultVariantId">) => {
    if (!isAuthenticated) {
      toggleLocalWishlist(product.id);
      return;
    }
    const existing = serverItems.find((i) => i.product.id === product.id);
    if (existing) {
      await customerBackendApi.deleteWishlistItem(existing.id);
    } else {
      await customerBackendApi.addWishlistItem({
        productId: product.id,
        variantId: product.defaultVariantId ?? undefined
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["customer-wishlist"] });
  };

  return { inWishlist, toggle, remoteQuery };
}
