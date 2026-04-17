type PdpVariant = {
  id: string;
  label: string;
  inStock: boolean;
};

type VariantSelectorProps = {
  variants: PdpVariant[];
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string) => void;
};

export const VariantSelector = ({
  variants,
  selectedVariantId,
  onSelectVariant
}: VariantSelectorProps) => {
  if (variants.length <= 1) {
    return null;
  }

  return (
    <div className="mb-10">
      <div className="flex justify-between items-end mb-4">
        <span className="text-xs font-label font-bold uppercase tracking-widest">Options</span>
        <button type="button" className="text-[10px] font-label text-secondary underline underline-offset-2 uppercase tracking-widest font-bold">
          Size Guide
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            disabled={!variant.inStock}
            onClick={() => variant.inStock && onSelectVariant(variant.id)}
            className={`py-3 px-2 text-xs font-label border transition-colors text-center ${
              !variant.inStock
                ? "border-outline-variant opacity-40 cursor-not-allowed line-through"
                : selectedVariantId === variant.id
                  ? "border-on-surface bg-on-surface text-white"
                  : "border-outline-variant hover:border-on-surface"
            }`}
          >
            {variant.label}
          </button>
        ))}
      </div>
    </div>
  );
};
