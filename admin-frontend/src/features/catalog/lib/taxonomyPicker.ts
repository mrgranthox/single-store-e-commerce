/** Only active taxonomy rows are assignable to products; keep selected rows visible so admins can clear legacy links. */
export const categoriesForProductPicker = <T extends { id: string; status: string }>(
  items: T[],
  selectedCategoryIds: readonly string[]
): T[] => {
  const selected = new Set(selectedCategoryIds);
  return items.filter((row) => row.status === "ACTIVE" || selected.has(row.id));
};

export const brandsForProductPicker = <T extends { id: string; status: string }>(
  items: T[],
  selectedBrandId: string | null | undefined
): T[] => {
  if (!selectedBrandId) {
    return items.filter((row) => row.status === "ACTIVE");
  }
  return items.filter((row) => row.status === "ACTIVE" || row.id === selectedBrandId);
};
