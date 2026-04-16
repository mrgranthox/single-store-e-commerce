import { useQuery } from "@tanstack/react-query";

import { customerBackendApi } from "@/lib/api/customer-backend-api";
import { cartItemCountFromEvaluation } from "@/lib/catalog/storefront-mappers";
import { useCustomerStore } from "@/lib/store/customer-store";

/** Root segment for TanStack Query; use with `invalidateQueries({ queryKey: [CUSTOMER_CART_QUERY_ROOT] })` (prefix match). */
export const CUSTOMER_CART_QUERY_ROOT = "customer-cart-eval" as const;

/** Guest vs signed-in carts must not share one cache entry (and must not collide with a numeric `select` cache bug). */
export const useCustomerCartQueryKey = () => {
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  return [CUSTOMER_CART_QUERY_ROOT, isAuthenticated] as const;
};

const cartEvaluationQueryFn = async () => {
  const { data } = await customerBackendApi.getCart();
  return data;
};

/**
 * Bag badge count. Uses the **same** query payload as the cart page (full evaluation in cache, `select` for the number).
 */
export const useCartItemCount = () => {
  const queryKey = useCustomerCartQueryKey();
  const query = useQuery({
    queryKey,
    queryFn: cartEvaluationQueryFn,
    select: (data) => cartItemCountFromEvaluation(data),
    staleTime: 5_000,
    retry: 1
  });
  return query.data ?? 0;
};

export const useCartEvaluationQuery = () => {
  const queryKey = useCustomerCartQueryKey();
  return useQuery({
    queryKey,
    queryFn: cartEvaluationQueryFn,
    staleTime: 5_000,
    retry: 1
  });
};
