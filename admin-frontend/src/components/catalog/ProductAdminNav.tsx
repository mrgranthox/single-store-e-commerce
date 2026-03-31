import { Link, NavLink, useParams } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "border-b-2 px-1 pb-2.5 text-sm font-semibold transition-colors",
    isActive ? "border-[#4f7ef8] text-[#4f7ef8]" : "border-transparent text-[#6b7280] hover:text-slate-800"
  ].join(" ");

export const ProductAdminNav = () => {
  const { productId } = useParams<{ productId: string }>();
  if (!productId) {
    return null;
  }
  const base = `/admin/catalog/products/${productId}`;

  const items: { key: string; to: string; label: string; end?: boolean }[] = [
    { key: "detail", to: base, label: "Overview", end: true },
    { key: "analytics", to: `${base}/analytics`, label: "Analytics" },
    { key: "variants", to: `${base}/variants`, label: "Variants" },
    { key: "media", to: `${base}/media`, label: "Media" },
    { key: "pricing", to: `${base}/pricing`, label: "Pricing" },
    { key: "inventory", to: `${base}/inventory`, label: "Inventory" }
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-1 pt-1 lg:flex-row lg:items-end lg:justify-between">
      <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Product sections">
        {items.map((item) => (
          <NavLink key={item.key} to={item.to} end={item.end} className={tabClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Link
        to="/admin/catalog/products"
        className="pb-2.5 text-sm font-medium text-[#6b7280] hover:text-slate-900 lg:shrink-0"
      >
        ← All products
      </Link>
    </div>
  );
};
