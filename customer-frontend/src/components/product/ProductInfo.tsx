import { Link } from "react-router-dom";

import { Icon } from "@/components/Icon";
import { StarRating } from "@/components/ui";
import { formatGhs } from "@/lib/currency";
import type { Product } from "@/lib/types/product";
import { VariantSelector } from "@/components/product/VariantSelector";

type ProductInfoProps = {
  product: Product;
  reviewRating: number;
  reviewCount: number;
  availabilityMessage?: string;
  selectedVariantId: string | null;
  selectedVariant?: NonNullable<Product["pdpVariants"]>[number];
  onSelectVariant: (variantId: string) => void;
  cartBusy: boolean;
  cartErr: string | null;
  wishlistActive: boolean;
  onAddToCart: () => void;
  onToggleWishlist: () => void;
};

export const ProductInfo = ({
  product,
  reviewRating,
  reviewCount,
  availabilityMessage,
  selectedVariantId,
  selectedVariant,
  onSelectVariant,
  cartBusy,
  cartErr,
  wishlistActive,
  onAddToCart,
  onToggleWishlist
}: ProductInfoProps) => {
  const currentPrice = selectedVariant?.price ?? product.price;
  const selectedStock = typeof selectedVariant?.stock === "number" ? selectedVariant.stock : null;
  const showLowStockWarning =
    selectedStock != null && selectedStock > 0 && selectedStock <= 5;
  const canAddToCart =
    Boolean(selectedVariantId) && !cartBusy && (selectedVariant ? selectedVariant.inStock : true);

  return (
    <div className="col-span-12 lg:col-span-5 min-w-0">
      <div className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StarRating rating={reviewRating} />
          <Link
            to={`/products/${product.slug}/reviews`}
            className="text-xs font-label text-outline hover:text-secondary underline underline-offset-4"
          >
            {reviewCount} reviews
          </Link>
          <span className="text-outline hidden sm:inline">·</span>
          <Link
            to={`/products/${product.slug}/questions`}
            className="text-xs font-label text-secondary font-bold uppercase tracking-widest hover:underline"
          >
            Q&amp;A
          </Link>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tighter text-on-surface mb-2 break-words">
          {product.name}
        </h1>
        <p className="text-outline font-body mb-6 sm:mb-8 leading-relaxed max-w-full sm:max-w-md text-sm sm:text-base min-h-[3.5rem]">
          {product.description ?? "No description available for this product."}
        </p>

        <div className="mb-8 sm:mb-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            <div className="flex flex-col min-w-0">
              {product.originalPrice && (
                <span className="text-xs font-label text-outline line-through">
                  {formatGhs(product.originalPrice)}
                </span>
              )}
              <span className="text-2xl sm:text-3xl font-headline font-bold text-on-surface tabular-nums">
                {formatGhs(currentPrice)}
              </span>
            </div>
            {product.originalPrice && product.originalPrice > currentPrice ? (
              <div className="bg-secondary-container text-white px-3 py-1 rounded-sm text-xs font-label font-bold flex items-center gap-1 self-end mb-0.5">
                {`Save ${formatGhs(product.originalPrice - currentPrice, 0)}`}
              </div>
            ) : null}
          </div>
          <div className="sm:ml-auto sm:text-right pt-1 sm:pt-0 border-t border-outline-variant/15 sm:border-0 min-h-[1.25rem]">
            {showLowStockWarning ? (
              <span className="text-[10px] font-label font-bold text-error uppercase tracking-widest inline-flex items-center gap-1 sm:justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse shrink-0" />
                Only {selectedStock} left
              </span>
            ) : availabilityMessage ? (
              <span className="text-[10px] font-label font-bold text-error uppercase tracking-widest inline-flex items-center gap-1 sm:justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse shrink-0" />
                {availabilityMessage}
              </span>
            ) : null}
          </div>
        </div>

        {product.colorVariants && product.colorVariants.length > 0 ? (
          <div className="mb-8">
            <div className="flex justify-between items-end mb-4">
              <span className="text-xs font-label font-bold uppercase tracking-widest">
                Color: <span className="text-outline font-normal">{product.colorVariants[0]!.name}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {product.colorVariants.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className="w-10 h-10 rounded-full border-2 border-on-surface ring-2 ring-offset-2 ring-on-surface transition-all"
                  style={{ backgroundColor: color.hex }}
                  aria-label={`Color option ${color.name}`}
                />
              ))}
            </div>
          </div>
        ) : null}

        <VariantSelector
          variants={product.pdpVariants ?? []}
          selectedVariantId={selectedVariantId}
          onSelectVariant={onSelectVariant}
        />

        <div className="flex flex-row gap-3 sm:gap-4 mb-10 items-stretch">
          <button
            type="button"
            disabled={!canAddToCart}
            onClick={onAddToCart}
            className="flex-1 min-w-0 min-h-[3.5rem] sm:min-h-[3.75rem] bg-primary text-on-primary py-3 sm:py-4 rounded-sm font-label font-bold uppercase tracking-widest hover:bg-secondary transition-all active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base px-2 sm:px-4 disabled:opacity-50"
          >
            <Icon name={cartBusy ? "progress_activity" : "shopping_bag"} className="shrink-0" />
            <span className="text-center leading-tight">
              {cartBusy ? "Adding..." : "Add to Bag"}
            </span>
          </button>
          <button
            type="button"
            onClick={onToggleWishlist}
            className="shrink-0 w-14 min-h-[3.5rem] sm:w-16 sm:min-h-[3.75rem] border border-outline-variant flex items-center justify-center hover:bg-surface-container-low transition-colors group"
          >
            <Icon
              name="favorite"
              filled={wishlistActive}
              className={`group-hover:text-error transition-colors ${wishlistActive ? "text-error" : ""}`}
            />
          </button>
        </div>
        {cartErr ? <p className="text-error text-xs mb-4">{cartErr}</p> : null}

        <div className="bg-surface-container-low p-4 sm:p-6 rounded-sm space-y-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <Icon name="local_shipping" className="text-secondary shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-label font-bold uppercase tracking-wider mb-1">Complimentary Shipping</h4>
              <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
                Standard and express options at checkout. Most orders ship within 3-5 business days.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <Icon name="verified_user" className="text-secondary shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-label font-bold uppercase tracking-wider mb-1">Authenticity Guaranteed</h4>
              <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
                Each piece includes a digital certificate of authenticity and unique serial number.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
