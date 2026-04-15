import { useQuery } from "@tanstack/react-query";

import { customerBackendApi } from "@/lib/api/customer-backend-api";
import { cartItemCountFromEvaluation } from "@/lib/catalog/storefront-mappers";

export const useCartItemCount = () => {
  const query = useQuery({
    queryKey: ["customer-cart-eval"],
    queryFn: async () => {
      const { data } = await customerBackendApi.getCart();
      return cartItemCountFromEvaluation(data);
    },
    staleTime: 15_000,
    retry: 1
  });
  return query.data ?? 0;
};

export const useCartEvaluationQuery = () =>
  useQuery({
    queryKey: ["customer-cart-eval"],
    queryFn: async () => {
      const { data } = await customerBackendApi.getCart();
      return data;
    },
    staleTime: 10_000,
    retry: 1
  });
