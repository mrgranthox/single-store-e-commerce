import type React from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { neutralFieldClass } from "@/lib/form-field-styles";
import { useCustomerStore } from "@/lib/store/customer-store";
import type { Product } from "@/lib/data/customer-mock";

/* ── input ── */
export const fieldClass = `w-full rounded-lg px-4 py-4 ${neutralFieldClass}`;

export const labelClass = "font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block mb-2";

export const FieldLabel = ({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className={labelClass}>
    {children}
  </label>
);

/* ── product card ── matches home_page/code.html exactly ── */
export const ProductCard = ({ product }: { product: Product }) => {
  const addToCart = useCustomerStore((s) => s.addToCart);
  const wishlist = useCustomerStore((s) => s.wishlist);
  const toggleWishlist = useCustomerStore((s) => s.toggleWishlist);
  const inWishlist = wishlist.includes(product.id);

  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(product.rating ?? 4));

  return (
    <div className="group min-w-0 max-w-full">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-container-low mb-4 sm:mb-6 rounded-sm w-full">
        <img
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          src={product.imageUrl}
          alt={product.name}
        />
        {product.badge && (
          <div className="absolute top-4 left-4">
            <span
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                product.badge === "Sale" || product.badge?.startsWith("-")
                  ? "bg-error text-white"
                  : "bg-tertiary-fixed text-on-tertiary-fixed"
              }`}
            >
              {product.badge}
            </span>
          </div>
        )}
        <button
          onClick={() => toggleWishlist(product.id)}
          className="absolute top-4 right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        >
          <Icon name="favorite" filled={inWishlist} className={inWishlist ? "text-error" : "text-on-surface"} />
        </button>
        <button
          onClick={() => addToCart({ productId: product.id, variantId: product.id, quantity: 1, price: product.price, name: product.name, imageUrl: product.imageUrl })}
          className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        >
          <Icon name="add_shopping_cart" className="text-on-surface" />
        </button>
      </div>
      <Link to={`/products/${product.slug}`} className="block min-w-0">
        <div className="flex justify-between items-start gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-outline text-xs uppercase tracking-widest mb-1">{product.category}</p>
            <h3 className="font-headline font-bold text-base sm:text-lg mb-2 break-words">{product.name}</h3>
            <div className="flex items-center gap-1 mb-2">
              {stars.map((filled, i) => (
                <Icon key={i} name="star" filled={filled} className="text-[16px] text-tertiary" />
              ))}
              <span className="text-[10px] text-outline ml-1 font-medium">({product.reviewCount ?? 0})</span>
            </div>
          </div>
          <div className="text-right shrink-0 tabular-nums">
            {product.originalPrice && (
              <p className="text-xs text-outline line-through">${product.originalPrice.toFixed(2)}</p>
            )}
            <p className={`font-headline font-bold text-base sm:text-lg ${product.originalPrice ? "text-error" : ""}`}>
              ${product.price.toFixed(2)}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
};

/* ── cart item image card ── */
export const CartItemImage = ({ src, alt }: { src: string; alt: string }) => (
  <div className="w-24 sm:w-28 md:w-48 shrink-0 aspect-[4/5] bg-surface-container-low overflow-hidden rounded-lg">
    <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={src} alt={alt} />
  </div>
);

/* ── trust cue badge ── */
export const TrustBadge = ({
  icon,
  title,
  sub,
  to,
  ariaLabel,
}: {
  icon: string;
  title: string;
  sub: string;
  to?: string;
  ariaLabel?: string;
}) => {
  const label = ariaLabel ?? `${title}. ${sub}`;
  const inner = (
    <div className="flex items-start gap-3 sm:gap-4 min-w-0">
      <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-white rounded-full flex items-center justify-center text-secondary shadow-sm">
        <Icon name={icon} className="text-[22px] sm:text-[24px]" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="font-bold text-sm leading-snug break-words">{title}</p>
        <p className="text-xs text-on-surface-variant mt-0.5 break-words leading-snug">{sub}</p>
      </div>
    </div>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="block min-w-0 rounded-xl -m-1 p-2 sm:p-1 hover:bg-surface-container-low/70 active:bg-surface-container-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest"
        aria-label={label}
      >
        {inner}
      </Link>
    );
  }
  return <div className="min-w-0">{inner}</div>;
};

/* ── checkout order summary ── */
export const CheckoutOrderSummary = ({
  items,
  subtotal,
  shipping,
  tax,
  total,
}: {
  items: { name: string; variant?: string; qty?: number; price: number; image: string }[];
  subtotal?: number;
  shipping?: string;
  tax?: number;
  total?: number;
}) => (
  <aside className="mt-10 lg:mt-0 w-full lg:w-[400px] max-w-full">
    <div className="bg-surface-container-low p-5 sm:p-8 rounded-xl lg:sticky lg:top-28">
      <h3 className="font-headline text-xl font-bold mb-8">Order Summary</h3>
      <div className="space-y-6 mb-8">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4">
            <div className="w-20 h-24 bg-surface-container-highest rounded-lg overflow-hidden flex-shrink-0">
              <img className="w-full h-full object-cover" src={item.image} alt={item.name} />
            </div>
            <div className="flex flex-col justify-between py-1">
              <div>
                <h4 className="font-bold text-sm mb-1">{item.name}</h4>
                {item.variant && <p className="text-xs text-on-surface-variant">{item.variant}</p>}
              </div>
              <div className="flex justify-between items-center">
                {item.qty != null && <span className="text-xs font-label text-outline">Qty: {item.qty}</span>}
                <p className="font-bold text-sm">${item.price.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-4 border-t border-outline-variant/20 pt-8">
        {subtotal != null && (
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Subtotal</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Shipping</span>
          <span className="font-medium">{shipping ?? "Calculated at next step"}</span>
        </div>
        {tax != null && (
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Tax</span>
            <span className="font-medium">${tax.toFixed(2)}</span>
          </div>
        )}
        {total != null && (
          <div className="flex justify-between text-lg font-extrabold border-t border-outline-variant/20 pt-6 mt-2">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        )}
      </div>
      <div className="mt-8 flex gap-2">
        <input
          className={`flex-1 rounded px-4 py-3 text-sm ${neutralFieldClass}`}
          placeholder="Promo Code"
          type="text"
        />
        <button className="bg-primary text-on-primary px-4 py-3 text-xs font-bold uppercase tracking-widest rounded hover:opacity-90">
          Apply
        </button>
      </div>
      <div className="mt-8 flex items-center gap-3 p-4 bg-tertiary-fixed rounded-lg text-on-tertiary-fixed">
        <Icon name="verified" />
        <p className="text-xs font-medium">Authenticity Guaranteed & 30-Day Free Returns</p>
      </div>
    </div>
  </aside>
);

/* ── order status badge ── */
const statusStyles: Record<string, string> = {
  Processing: "bg-tertiary-fixed text-on-tertiary-fixed",
  Shipped: "bg-secondary-fixed text-on-secondary-fixed",
  Delivered: "bg-surface-container-high text-on-surface-variant",
  Cancelled: "bg-error-container text-on-error-container",
  Returned: "bg-surface-container-high text-on-surface-variant",
};

export const OrderStatusBadge = ({ status }: { status: string }) => (
  <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded ${statusStyles[status] ?? "bg-surface-container-high text-on-surface-variant"}`}>
    {status}
  </span>
);

/* ── rating stars ── */
export const StarRating = ({ rating, count }: { rating: number; count?: number }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: 5 }, (_, i) => (
      <Icon key={i} name="star" filled={i < Math.round(rating)} className="text-[16px] text-tertiary" />
    ))}
    {count != null && <span className="text-[10px] text-outline ml-1 font-medium">({count})</span>}
  </div>
);
