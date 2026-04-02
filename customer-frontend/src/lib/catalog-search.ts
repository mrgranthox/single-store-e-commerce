import type { Product } from "@/lib/data/customer-mock";

/** Normalise for matching (slug fragments, diacritics-safe ASCII). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s/-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Search the full product catalogue: name, slug, category, description, brand.
 * Multi-word queries: every token must match somewhere in the combined haystack.
 */
export function searchCatalog(products: Product[], rawQuery: string): Product[] {
  const q = norm(rawQuery);
  if (!q) return products;

  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length === 0) return products;

  return products.filter((p) => {
    const hay = norm(
      [p.name, p.slug.replace(/-/g, " "), p.category, p.description ?? "", p.brand ?? ""].join(" ")
    );
    return tokens.every((t) => hay.includes(t));
  });
}
