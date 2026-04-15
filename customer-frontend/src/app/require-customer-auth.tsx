import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCustomerStore } from "@/lib/store/customer-store";

export function sanitizeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw.trim());
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  if (decoded.includes("://") || decoded.includes("\\")) return null;
  return decoded;
}

export const RequireCustomerAuth = ({ children }: { children: ReactNode }) => {
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return children;
};
