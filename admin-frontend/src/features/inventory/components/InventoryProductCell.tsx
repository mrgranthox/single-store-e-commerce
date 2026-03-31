import { Link } from "react-router-dom";

export const InventoryProductCell = ({
  productId,
  title,
  thumbnailUrl,
  borderClass = ""
}: {
  productId: string;
  title: string;
  thumbnailUrl?: string | null;
  borderClass?: string;
}) => (
  <div className={`flex min-w-0 items-center gap-3 ${borderClass}`}>
    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">—</div>
      )}
    </div>
    <Link
      to={`/admin/catalog/products/${productId}`}
      className="line-clamp-2 min-w-0 font-semibold text-sm text-[#1653cc] hover:underline"
    >
      {title}
    </Link>
  </div>
);
