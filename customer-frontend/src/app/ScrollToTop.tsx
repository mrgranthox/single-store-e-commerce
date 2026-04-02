import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Reset window scroll on client-side navigation (React Router does not scroll by default). */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
}
