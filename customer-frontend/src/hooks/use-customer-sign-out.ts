import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { customerAuthApi } from "@/lib/api/customer-auth-api";
import { useCustomerStore } from "@/lib/store/customer-store";

export function useCustomerSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOutStore = useCustomerStore((s) => s.signOut);

  return async () => {
    try {
      await customerAuthApi.logout();
    } catch {
      /* still clear local session */
    }
    signOutStore();
    await queryClient.invalidateQueries();
    navigate("/");
  };
}
