export type OrderPreviewLine = {
  quantity: number;
  imageUrl: string | null;
};

export const variantPrimaryImageUrl = (
  variant:
    | {
        media: Array<{ url: string; kind: string | null }>;
      }
    | null
    | undefined
): string | null => {
  if (!variant?.media?.length) {
    return null;
  }
  const image =
    variant.media.find((m) => typeof m.kind === "string" && m.kind.toUpperCase() === "IMAGE") ?? variant.media[0];
  const u = image?.url?.trim();
  return u || null;
};

/**
 * Order card preview: unique max quantity → that line's image; tie → first line in order.
 * `previewImageUrls`: up to 4 distinct URLs in line order (for thumbnail grid when ≥2).
 */
export const buildOrderCardPreview = (
  lines: readonly OrderPreviewLine[]
): { previewImageUrl: string | null; previewImageUrls: string[] } => {
  if (lines.length === 0) {
    return { previewImageUrl: null, previewImageUrls: [] };
  }

  const maxQ = Math.max(...lines.map((l) => l.quantity));
  const winners = lines.filter((l) => l.quantity === maxQ);
  const primaryLine = winners.length === 1 ? winners[0]! : lines[0]!;
  const previewImageUrl = primaryLine.imageUrl;

  const previewImageUrls: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const u = line.imageUrl?.trim();
    if (!u || seen.has(u)) {
      continue;
    }
    seen.add(u);
    previewImageUrls.push(u);
    if (previewImageUrls.length >= 4) {
      break;
    }
  }

  return { previewImageUrl, previewImageUrls };
};
