/** Aligns with backend `taxonomySlugSchema` normalization (hyphens, no underscores). */
export const normalizeTaxonomySlugInput = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
