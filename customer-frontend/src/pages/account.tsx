import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountLayout } from "@/components/layout";
import { OrderStatusBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  formatGhsFromCents,
  formatIsoDate,
  formatOrderStatusLabel,
  readGrandTotalCents,
  ticketStatusBadgeClass
} from "@/lib/account/account-ui";
import { customerBackendApi } from "@/lib/api/customer-backend-api";
import { CommerceApiError } from "@/lib/api/commerce-fetch";
import { neutralFieldClass } from "@/lib/form-field-styles";
import { STORE_NAME_FULL, STORE_NAME_SHORT, SUPPORT_SENDER_LABEL } from "@/lib/brand";

/* ─────────────────────────────────────────────
   ACCOUNT DASHBOARD
───────────────────────────────────────────── */
type AccountOverviewEntity = {
  profile: { firstName: string | null; lastName: string | null; email: string | null; status?: string | null };
  counts: {
    orders: number;
    openTickets: number;
    wishlistItems: number;
    addresses: number;
  };
  recentOrders: Array<{ id: string; orderNumber: string; status: string; createdAt: string }>;
};

export const AccountDashboardPage = () => {
  const { data, isPending, error } = useQuery({
    queryKey: ["account", "overview"],
    queryFn: async () => {
      const res = await customerBackendApi.getAccountOverview();
      return res.data as { entity: AccountOverviewEntity };
    }
  });

  const entity = data?.entity;
  const displayName = entity
    ? [entity.profile.firstName, entity.profile.lastName].filter(Boolean).join(" ") || entity.profile.email || "there"
    : "there";
  const orderCount = entity?.counts.orders ?? 0;
  const openTickets = entity?.counts.openTickets ?? 0;
  const wishlistCount = entity?.counts.wishlistItems ?? 0;
  const addressCount = entity?.counts.addresses ?? 0;

  const quick = [
    { to: "/account/orders", label: "Orders", sub: "Track & returns", icon: "package_2" as const },
    { to: "/wishlist", label: "Wishlist", sub: `${wishlistCount} saved`, icon: "favorite" as const },
    { to: "/account/addresses", label: "Addresses", sub: `${addressCount} saved`, icon: "home_pin" as const },
    { to: "/account/support", label: "Support", sub: `${openTickets} open`, icon: "support_agent" as const }
  ];

  return (
    <AccountLayout>
      <section className="mb-8 sm:mb-10 rounded-2xl border border-outline-variant/20 bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-secondary/5 p-5 sm:p-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <p className="text-[10px] sm:text-xs font-label font-bold uppercase tracking-[0.2em] text-outline mb-2">Your {STORE_NAME_SHORT}</p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tight text-on-background mb-1">
          Welcome back, {displayName}
        </h1>
        <p className="text-sm sm:text-base text-on-surface-variant max-w-xl leading-relaxed">
          {entity?.profile.status === "ACTIVE" ? "Active account" : "Member"} · Orders, wishlist, and support in one place.
        </p>
        <div className="mt-5 sm:mt-6 flex flex-wrap gap-2 sm:gap-3">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-secondary text-on-secondary px-4 py-2.5 rounded-xl text-xs sm:text-sm font-label font-bold uppercase tracking-wide hover:opacity-95 transition-opacity"
          >
            Continue shopping
            <Icon name="arrow_forward" className="text-base" />
          </Link>
          <Link
            to="/account/profile"
            className="inline-flex items-center gap-2 border border-outline-variant/30 text-on-background px-4 py-2.5 rounded-xl text-xs sm:text-sm font-label font-bold uppercase tracking-wide hover:border-secondary/40 hover:text-secondary transition-colors"
          >
            Edit profile
          </Link>
        </div>
      </section>

      <h2 className="sr-only">Shortcuts</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10 sm:mb-12">
        {quick.map(({ to, label, sub, icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:p-5 hover:border-secondary/25 hover:shadow-[0_12px_40px_rgba(11,28,48,0.07)] transition-all min-h-[7.5rem] sm:min-h-0"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <span className="inline-flex size-10 sm:size-11 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <Icon name={icon} className="text-xl" />
              </span>
              <Icon name="chevron_right" className="text-outline group-hover:text-secondary transition-colors text-lg shrink-0" />
            </div>
            <span className="font-headline font-bold text-on-background text-sm sm:text-base">{label}</span>
            <span className="text-xs text-on-surface-variant mt-1 leading-snug">{sub}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-10 sm:mb-12">
        {[
          { label: "Lifetime orders", value: String(orderCount), hint: "All time" },
          { label: "Wishlist", value: String(wishlistCount), hint: "Saved pieces" },
          { label: "Open tickets", value: String(openTickets), hint: "Needs reply" }
        ].map(({ label, value, hint }) => (
          <div
            key={label}
            className="rounded-xl border border-outline-variant/15 bg-surface-container-low/50 px-4 py-3 sm:py-4 flex flex-row sm:flex-col sm:items-start justify-between sm:justify-start gap-1"
          >
            <div>
              <p className="text-[10px] sm:text-xs font-label font-bold uppercase tracking-widest text-outline">{label}</p>
              <p className="text-xl sm:text-2xl font-headline font-extrabold text-on-background tabular-nums">{value}</p>
            </div>
            <p className="text-[10px] text-on-surface-variant sm:mt-1">{hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 sm:mb-6">
        <h2 className="font-headline text-lg sm:text-xl font-bold text-on-background">Recent orders</h2>
        <Link to="/account/orders" className="text-secondary font-label font-bold text-xs uppercase tracking-widest hover:underline underline-offset-4 self-start sm:self-auto">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {isPending ? <p className="text-on-surface-variant text-sm">Loading recent orders…</p> : null}
        {error ? (
          <p className="text-error text-sm">
            {error instanceof CommerceApiError ? error.message : "Could not load account overview."}
          </p>
        ) : null}
        {(entity?.recentOrders ?? []).slice(0, 2).map((order) => (
          <div
            key={order.id}
            className="group bg-surface-container-lowest p-4 sm:p-6 rounded-2xl border border-outline-variant/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 hover:border-outline-variant/35 transition-colors"
          >
            <div className="flex gap-4 flex-1 min-w-0">
              <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface-container flex items-center justify-center text-secondary">
                <Icon name="package_2" className="text-3xl" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-xs font-medium text-outline">#{order.orderNumber}</span>
                </div>
                <h3 className="text-base sm:text-lg font-headline font-bold text-on-background truncate">Order {order.orderNumber}</h3>
                <p className="text-xs sm:text-sm text-on-surface-variant">{formatIsoDate(order.createdAt)}</p>
              </div>
            </div>
            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/15 sm:min-w-[7rem]">
              <div className="text-left sm:text-right">
                <p className="text-[10px] uppercase tracking-widest font-bold text-outline mb-0.5">Status</p>
                <p className="text-sm font-headline font-bold text-on-background">{formatOrderStatusLabel(order.status)}</p>
              </div>
              <Link
                to={`/account/orders/${order.id}`}
                className="inline-flex items-center gap-1 text-secondary font-bold text-xs sm:text-sm hover:underline underline-offset-4 whitespace-nowrap"
              >
                Details
                <Icon name="arrow_forward" className="text-sm" />
              </Link>
            </div>
          </div>
        ))}
        {!isPending && !error && (entity?.recentOrders?.length ?? 0) === 0 ? (
          <p className="text-on-surface-variant text-sm">No orders yet. Browse the shop to get started.</p>
        ) : null}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   ORDERS LIST — matches order_history/code.html
───────────────────────────────────────────── */
type OrderListRow = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  totals?: unknown;
};

export const OrdersListPage = () => {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isPending, error } = useQuery({
    queryKey: ["account", "orders", page, statusFilter],
    queryFn: async () => {
      const res = await customerBackendApi.listOrders({
        page,
        page_size: 20,
        status: statusFilter || undefined
      });
      return {
        items: (res.data as { items?: OrderListRow[] }).items ?? [],
        meta: res.meta
      };
    }
  });

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((o) => o.orderNumber.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
  }, [data?.items, search]);

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-5xl md:text-6xl font-headline font-extrabold tracking-tighter text-on-background mb-4">Order History</h1>
        <p className="text-on-surface-variant font-body text-lg max-w-2xl">
          Track your recent orders and archived purchases from {STORE_NAME_FULL}.
        </p>
      </header>

      {/* Search & Filters */}
      <section className="bg-white border border-outline-variant/20 p-6 rounded-xl mb-12 flex flex-col md:flex-row gap-6 items-end shadow-sm">
        <div className="w-full md:w-1/3">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">Search Orders</label>
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-lg py-3 pl-12 pr-3 font-body text-sm ${neutralFieldClass}`}
              placeholder="Order #, Product, or Date"
              type="text"
            />
            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          </div>
        </div>
        <div className="w-full md:w-1/4">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className={`w-full rounded-lg py-3 px-4 font-body text-sm outline-none ${neutralFieldClass}`}
          >
            <option value="">All Statuses</option>
            <option value="PENDING_PAYMENT">Pending payment</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div className="w-full md:w-1/4">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-2">Date Range</label>
          <select className={`w-full rounded-lg py-3 px-4 font-body text-sm outline-none ${neutralFieldClass}`}>
            <option>Last 30 Days</option>
            <option>Last 6 Months</option>
            <option>Year 2023</option>
            <option>All Time</option>
          </select>
        </div>
        <button className="bg-primary text-on-primary h-[46px] px-8 rounded-lg font-bold font-headline text-sm hover:opacity-90 transition-opacity">
          Filter
        </button>
      </section>

      {isPending ? <p className="text-on-surface-variant">Loading orders…</p> : null}
      {error ? (
        <p className="text-error text-sm">{error instanceof CommerceApiError ? error.message : "Could not load orders."}</p>
      ) : null}

      {/* Order Cards */}
      <div className="grid grid-cols-1 gap-6">
        {filtered.map((order) => {
          const cents = readGrandTotalCents(order.totals);
          return (
            <div key={order.id} className="group bg-surface-container-lowest p-1 rounded-2xl transition-all duration-300 hover:shadow-[0_20px_40px_rgba(11,28,48,0.06)]">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20">
                <div className="flex-shrink-0 w-full lg:w-32 h-32 rounded-xl overflow-hidden bg-surface-container flex items-center justify-center text-secondary">
                  <Icon name="package_2" className="text-5xl" />
                </div>
                <div className="flex-grow mt-6 lg:mt-0 lg:px-8 space-y-1">
                  <div className="flex items-center gap-3 mb-2">
                    <OrderStatusBadge status={order.status} />
                    <span className="text-xs font-medium text-outline">Order #{order.orderNumber}</span>
                  </div>
                  <h3 className="text-xl font-headline font-bold text-on-background">Order {order.orderNumber}</h3>
                  <p className="text-sm text-on-surface-variant font-body">Placed on {formatIsoDate(order.createdAt)}</p>
                </div>
                <div className="mt-6 lg:mt-0 lg:text-right border-t lg:border-t-0 lg:border-l border-outline-variant/20 pt-6 lg:pt-0 lg:pl-12">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-outline mb-1">Total</p>
                  <p className="text-2xl font-headline font-extrabold text-on-background">
                    {cents != null ? formatGhsFromCents(cents) : "—"}
                  </p>
                  <Link
                    to={`/account/orders/${order.id}`}
                    className="inline-flex items-center gap-2 mt-4 text-secondary font-bold text-sm hover:underline underline-offset-4"
                  >
                    View Details <Icon name="arrow_forward" className="text-sm" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="mt-16 flex justify-center items-center space-x-4">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="w-10 h-10 rounded-full flex items-center justify-center text-outline hover:bg-surface-container-high transition-colors disabled:opacity-40"
        >
          <Icon name="chevron_left" />
        </button>
        <span className="text-sm text-on-surface-variant px-2">
          Page {data?.meta && typeof data.meta === "object" && "page" in data.meta ? String((data.meta as { page: number }).page) : page}
          {data?.meta && typeof data.meta === "object" && "totalPages" in data.meta
            ? ` / ${String((data.meta as { totalPages: number }).totalPages)}`
            : ""}
        </span>
        <button
          type="button"
          disabled={
            !data?.meta ||
            typeof data.meta !== "object" ||
            !("totalPages" in data.meta) ||
            page >= (data.meta as { totalPages: number }).totalPages
          }
          onClick={() => setPage((p) => p + 1)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-outline hover:bg-surface-container-high transition-colors disabled:opacity-40"
        >
          <Icon name="chevron_right" />
        </button>
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   ORDER DETAIL
───────────────────────────────────────────── */
type OrderDetailEntity = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  items: Array<{
    id: string;
    productTitle: string;
    quantity: number;
    unitPriceAmountCents: number;
    lineTotalCents: number;
  }>;
  totals?: unknown;
  addressSnapshot: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    region?: string | null;
    country?: string | null;
    postalCode?: string | null;
  };
  fulfillment?: { trackingAvailable?: boolean };
  eligibility?: { canReturn?: boolean };
};

export const OrderDetailPage = () => {
  const { orderId } = useParams();

  const { data, isPending, error } = useQuery({
    queryKey: ["account", "order", orderId],
    queryFn: async () => {
      const res = await customerBackendApi.getOrder(orderId!);
      return res.data as { entity: OrderDetailEntity };
    },
    enabled: Boolean(orderId)
  });

  const { data: reviewEligibilityPayload } = useQuery({
    queryKey: ["account", "review-eligibility", orderId],
    queryFn: async () => {
      const res = await customerBackendApi.getOrderReviewEligibility(orderId!);
      return res.data as { entity: { canReview: boolean } };
    },
    enabled: Boolean(orderId)
  });

  const order = data?.entity;
  const canWriteReview = Boolean(reviewEligibilityPayload?.entity?.canReview);

  if (!orderId) {
    return null;
  }

  if (!isPending && (error || !order)) {
    return (
      <AccountLayout>
        <header className="mb-8">
          <h1 className="text-3xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Order not found</h1>
          <p className="text-on-surface-variant mb-6">We could not find that order in your account.</p>
          <Link to="/account/orders" className="text-secondary font-bold hover:underline underline-offset-4">
            Back to order history
          </Link>
        </header>
      </AccountLayout>
    );
  }

  if (isPending || !order) {
    return (
      <AccountLayout>
        <p className="text-on-surface-variant">Loading order…</p>
      </AccountLayout>
    );
  }

  const grand = readGrandTotalCents(order.totals);
  const addr = order.addressSnapshot;
  const addrLines = [addr.fullName, addr.line1, addr.line2, [addr.city, addr.region, addr.postalCode].filter(Boolean).join(", "), addr.country].filter(
    Boolean
  ) as string[];

  return (
    <AccountLayout>
      <nav className="flex items-center gap-2 text-xs font-label tracking-widest uppercase text-outline mb-10">
        <Link className="hover:text-secondary transition-colors" to="/account/orders">Orders</Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <span className="text-on-surface">#{order.orderNumber}</span>
      </nav>
      <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">
            Order #{order.orderNumber}
          </h1>
          <div className="flex items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <p className="text-sm text-on-surface-variant">{formatIsoDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {order.fulfillment?.trackingAvailable ? (
            <Link
              to={`/account/orders/${order.id}/tracking`}
              className="bg-secondary text-on-secondary text-center px-6 py-3 rounded-md font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Track shipment
            </Link>
          ) : null}
          {order.eligibility?.canReturn ? (
            <Link
              to={`/account/orders/${order.id}/return`}
              className="bg-surface-container-high text-on-surface text-center px-6 py-3 rounded-md font-bold text-sm hover:bg-surface-container transition-colors"
            >
              Request return
            </Link>
          ) : null}
          {canWriteReview ? (
            <Link
              to={`/account/orders/${order.id}/review`}
              className="border-2 border-secondary text-secondary text-center px-6 py-3 rounded-md font-bold text-sm hover:bg-secondary/5 transition-colors"
            >
              Write a review
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="font-headline text-xl font-bold">Items</h2>
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-6 p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
              <div className="w-24 h-28 bg-surface-container rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center text-secondary">
                <Icon name="styler" className="text-3xl" />
              </div>
              <div className="flex flex-col justify-between flex-grow">
                <div>
                  <h3 className="font-headline font-bold text-lg">{item.productTitle}</h3>
                  <p className="text-sm text-on-surface-variant">Qty: {item.quantity}</p>
                </div>
                <p className="font-headline font-bold text-xl">{formatGhsFromCents(item.lineTotalCents)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-surface-container-low p-8 rounded-xl">
            <h3 className="font-headline font-bold text-lg mb-6">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Total</span>
                <span>{grand != null ? formatGhsFromCents(grand) : "—"}</span>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-xl space-y-4">
            <h3 className="font-headline font-bold text-lg">Shipping Address</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {addrLines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   PROFILE
───────────────────────────────────────────── */
export const ProfilePage = () => {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["account", "profile"],
    queryFn: async () => {
      const res = await customerBackendApi.getProfile();
      return res.data as {
        entity: { firstName: string | null; lastName: string | null; email: string | null; phoneNumber: string | null };
      };
    }
  });

  const entity = data?.entity;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!entity || initialized) return;
    setFirstName(entity.firstName ?? "");
    setLastName(entity.lastName ?? "");
    setPhoneNumber(entity.phoneNumber ?? "");
    setInitialized(true);
  }, [entity, initialized]);

  const mutation = useMutation({
    mutationFn: async () => {
      await customerBackendApi.patchProfile({ firstName, lastName, phoneNumber });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
    }
  });

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Profile</h1>
        <p className="text-on-surface-variant">Manage your personal information and preferences.</p>
      </header>
      <div className="max-w-2xl space-y-8">
        {isPending ? <p className="text-on-surface-variant text-sm">Loading profile…</p> : null}
        {error ? (
          <p className="text-error text-sm">{error instanceof CommerceApiError ? error.message : "Could not load profile."}</p>
        ) : null}
        <div className="flex items-center gap-6 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20">
          <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center">
            <span className="text-3xl font-headline font-bold text-secondary">
              {(firstName || entity?.firstName || "?").slice(0, 1)}
              {(lastName || entity?.lastName || "").slice(0, 1)}
            </span>
          </div>
          <div>
            <h2 className="font-headline font-bold text-xl">
              {[firstName || entity?.firstName, lastName || entity?.lastName].filter(Boolean).join(" ") || "Your profile"}
            </h2>
            <p className="text-on-surface-variant text-sm">{entity?.email ?? ""}</p>
          </div>
        </div>

        <form
          className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <h2 className="font-headline font-bold text-lg">Personal Information</h2>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">First Name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
              type="text"
            />
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Last Name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
              type="text"
            />
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Email Address</label>
            <input
              value={entity?.email ?? ""}
              readOnly
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass} opacity-70`}
              type="email"
            />
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Phone Number</label>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
              type="tel"
            />
          </div>
          {mutation.isError ? (
            <p className="text-error text-sm">
              {mutation.error instanceof CommerceApiError ? mutation.error.message : "Update failed."}
            </p>
          ) : null}
          {mutation.isSuccess ? <p className="text-secondary text-sm">Saved.</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   ADDRESSES
───────────────────────────────────────────── */
type AddressRow = {
  id: string;
  label: string | null;
  fullName: string;
  country: string;
  region: string;
  city: string;
  postalCode: string | null;
  addressLine1: string;
  addressLine2: string | null;
  isDefaultShipping: boolean;
};

export const AddressesPage = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [fullName, setFullName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("GH");

  const { data, isPending, error } = useQuery({
    queryKey: ["account", "addresses"],
    queryFn: async () => {
      const res = await customerBackendApi.listAddresses();
      return (res.data as { items?: AddressRow[] }).items ?? [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await customerBackendApi.createAddress({
        label: label.trim() || null,
        fullName: fullName.trim(),
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        region: region.trim(),
        postalCode: postalCode.trim() || null,
        country: country.trim(),
        isDefaultShipping: false
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account", "addresses"] });
      setShowForm(false);
      setLabel("");
      setFullName("");
      setAddressLine1("");
      setCity("");
      setRegion("");
      setPostalCode("");
    }
  });

  return (
    <AccountLayout>
      <header className="mb-12 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Addresses</h1>
          <p className="text-on-surface-variant">Manage your saved shipping addresses.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-secondary text-on-secondary px-6 py-3 rounded-md font-bold hover:opacity-90 transition-opacity"
        >
          <Icon name="add" />
          Add Address
        </button>
      </header>

      {isPending ? <p className="text-on-surface-variant text-sm">Loading addresses…</p> : null}
      {error ? (
        <p className="text-error text-sm">{error instanceof CommerceApiError ? error.message : "Could not load addresses."}</p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        {(data ?? []).map((row) => {
          const title = row.label?.trim() || "Address";
          const lines = [row.fullName, row.addressLine1, row.addressLine2, `${row.city}, ${row.region} ${row.postalCode ?? ""}`.trim(), row.country]
            .filter(Boolean)
            .join("\n");
          return (
            <div key={row.id} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 relative">
              {row.isDefaultShipping ? (
                <span className="absolute top-4 right-4 text-[10px] uppercase tracking-widest font-bold bg-secondary/10 text-secondary px-2 py-1 rounded">
                  Default shipping
                </span>
              ) : null}
              <div className="flex items-center gap-3 mb-3">
                <Icon name="home_pin" className="text-secondary" />
                <h3 className="font-headline font-bold">{title}</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-4 whitespace-pre-line">{lines}</p>
            </div>
          );
        })}

        {showForm ? (
          <div className="md:col-span-2 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20">
            <h3 className="font-headline font-bold text-lg mb-6">New Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Label</label>
                <input value={label} onChange={(e) => setLabel(e.target.value)} className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`} type="text" />
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Full Name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`} type="text" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Address line 1</label>
                <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`} type="text" />
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`} type="text" />
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Region</label>
                <input value={region} onChange={(e) => setRegion(e.target.value)} className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`} type="text" />
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Postal code</label>
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`} type="text" />
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Country</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`} type="text" />
              </div>
            </div>
            {createMutation.isError ? (
              <p className="text-error text-sm mt-4">
                {createMutation.error instanceof CommerceApiError ? createMutation.error.message : "Could not save address."}
              </p>
            ) : null}
            <div className="flex gap-4 mt-6">
              <button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="bg-secondary text-on-secondary px-6 py-3 rounded-md font-bold hover:opacity-90 disabled:opacity-60"
              >
                {createMutation.isPending ? "Saving…" : "Save Address"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-on-surface-variant font-medium hover:text-on-surface">
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   RETURNS LIST
───────────────────────────────────────────── */
export const ReturnsListPage = () => {
  const { data, isPending, error } = useQuery({
    queryKey: ["account", "returns"],
    queryFn: async () => {
      const res = await customerBackendApi.listReturns({ page: 1, page_size: 50 });
      return (res.data as { items?: unknown[] }).items ?? [];
    }
  });

  const items = (data ?? []) as Array<{
    id: string;
    orderNumber: string;
    status: string;
    requestedAt: string;
    itemCount: number;
  }>;

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Returns</h1>
        <p className="text-on-surface-variant">Manage and track your return requests.</p>
      </header>
      {isPending ? <p className="text-on-surface-variant">Loading…</p> : null}
      {error ? (
        <p className="text-error text-sm">{error instanceof CommerceApiError ? error.message : "Could not load returns."}</p>
      ) : null}
      {!isPending && !error && items.length === 0 ? (
        <div className="text-center py-20">
          <Icon name="assignment_return" className="text-6xl text-outline mb-4" />
          <h2 className="font-headline text-xl font-bold mb-3">No returns yet</h2>
          <p className="text-on-surface-variant mb-8">Need to return an item? Start a return from your order details.</p>
          <Link to="/account/orders" className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">
            View Orders
          </Link>
        </div>
      ) : null}
      <div className="space-y-4">
        {items.map((r) => (
          <div key={r.id} className="p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-bold text-outline uppercase tracking-widest">{r.status}</span>
              <span className="text-xs text-outline">Order #{r.orderNumber}</span>
            </div>
            <p className="text-sm text-on-surface-variant">
              Requested {formatIsoDate(r.requestedAt)} · {r.itemCount} item(s)
            </p>
          </div>
        ))}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   REFUNDS LIST
───────────────────────────────────────────── */
export const RefundsListPage = () => {
  const { data, isPending, error } = useQuery({
    queryKey: ["account", "refunds"],
    queryFn: async () => {
      const res = await customerBackendApi.listRefunds({ page: 1, page_size: 50 });
      return (res.data as { items?: unknown[] }).items ?? [];
    }
  });

  const items = (data ?? []) as Array<{
    id: string;
    state: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  }>;

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Refunds</h1>
        <p className="text-on-surface-variant">Track your refund requests and payment reversals.</p>
      </header>
      {isPending ? <p className="text-on-surface-variant">Loading…</p> : null}
      {error ? (
        <p className="text-error text-sm">{error instanceof CommerceApiError ? error.message : "Could not load refunds."}</p>
      ) : null}
      {!isPending && !error && items.length === 0 ? (
        <div className="text-center py-20">
          <Icon name="payments" className="text-6xl text-outline mb-4" />
          <h2 className="font-headline text-xl font-bold mb-3">No refunds yet</h2>
          <p className="text-on-surface-variant mb-8">Refunds typically process within 5-7 business days.</p>
        </div>
      ) : null}
      <div className="space-y-4">
        {items.map((r) => (
          <div key={r.id} className="p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 flex justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-bold text-outline uppercase tracking-widest">{r.state}</p>
              <p className="text-sm text-on-surface-variant mt-1">{formatIsoDate(r.createdAt)}</p>
            </div>
            <p className="font-headline font-bold text-lg">
              {formatGhsFromCents(r.amountCents)} {r.currency}
            </p>
          </div>
        ))}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   REVIEWS CENTER
───────────────────────────────────────────── */
export const ReviewsCenterPage = () => {
  const { data, isPending, error } = useQuery({
    queryKey: ["account", "reviews"],
    queryFn: async () => {
      const res = await customerBackendApi.listAccountReviews({ page: 1, page_size: 50 });
      return (res.data as { items?: unknown[] }).items ?? [];
    }
  });

  const items = (data ?? []) as Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    createdAt: string;
    productTitle?: string | null;
  }>;

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Reviews</h1>
        <p className="text-on-surface-variant">Reviews you have submitted appear here. Leave new reviews from completed orders.</p>
      </header>
      <div className="max-w-2xl space-y-6 mb-10">
        <h2 className="font-headline font-bold text-lg">Leave a review</h2>
        <p className="text-sm text-on-surface-variant">
          Open a <Link to="/account/orders" className="text-secondary font-bold hover:underline">delivered order</Link> and use <span className="font-semibold text-on-background">Write a review</span> on the order when you are eligible.
        </p>
      </div>
      {isPending ? <p className="text-on-surface-variant">Loading reviews…</p> : null}
      {error instanceof CommerceApiError ? <p className="text-error text-sm">{error.message}</p> : null}
      <div className="max-w-2xl space-y-4">
        {items.map((rev) => (
          <div key={rev.id} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20">
            <div className="flex justify-between gap-4 flex-wrap">
              <h3 className="font-headline font-bold">{rev.title || rev.productTitle || "Review"}</h3>
              <span className="text-sm text-outline">{formatIsoDate(rev.createdAt)}</span>
            </div>
            <p className="text-sm text-on-surface-variant mt-2">Rating: {rev.rating} / 5</p>
            {rev.body ? <p className="text-sm text-on-surface mt-3 leading-relaxed">{rev.body}</p> : null}
          </div>
        ))}
        {!isPending && !error && items.length === 0 ? (
          <p className="text-on-surface-variant text-sm">You have not submitted any reviews yet.</p>
        ) : null}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   SECURITY & SESSIONS
───────────────────────────────────────────── */
export const SecurityPage = () => {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: sessions, isPending: sessionsPending, error: sessionsError } = useQuery({
    queryKey: ["account", "security", "sessions"],
    queryFn: async () => {
      const res = await customerBackendApi.listSecuritySessions();
      return (res.data as { items?: unknown[] }).items ?? [];
    }
  });

  const sessionRows = (sessions ?? []) as Array<{
    id: string;
    deviceLabel: string | null;
    ipCountry: string | null;
    ipRegion: string | null;
    isCurrent: boolean;
  }>;

  const pwdMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match.");
      }
      await customerBackendApi.changePassword({
        currentPassword,
        newPassword,
        signOutOtherSessions: true
      });
    },
    onSuccess: async () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await queryClient.invalidateQueries({ queryKey: ["account", "security"] });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await customerBackendApi.deleteSecuritySession(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account", "security", "sessions"] });
    }
  });

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Security</h1>
        <p className="text-on-surface-variant">Manage your password and active sessions.</p>
      </header>
      <div className="max-w-2xl space-y-8">
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 space-y-6">
          <h2 className="font-headline font-bold text-lg">Change Password</h2>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Current Password</label>
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
              type="password"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">New Password</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
              type="password"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Confirm New Password</label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
              type="password"
              autoComplete="new-password"
            />
          </div>
          {pwdMutation.isError ? (
            <p className="text-error text-sm">
              {pwdMutation.error instanceof CommerceApiError
                ? pwdMutation.error.message
                : pwdMutation.error instanceof Error
                  ? pwdMutation.error.message
                  : "Password update failed."}
            </p>
          ) : null}
          {pwdMutation.isSuccess ? <p className="text-secondary text-sm">Password updated.</p> : null}
          <button
            type="button"
            disabled={pwdMutation.isPending}
            onClick={() => pwdMutation.mutate()}
            className="bg-secondary text-on-secondary px-6 py-3 rounded-md font-bold hover:opacity-90 disabled:opacity-60"
          >
            {pwdMutation.isPending ? "Updating…" : "Update Password"}
          </button>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20">
          <h2 className="font-headline font-bold text-lg mb-6">Active Sessions</h2>
          {sessionsPending ? <p className="text-sm text-on-surface-variant">Loading sessions…</p> : null}
          {sessionsError ? (
            <p className="text-error text-sm">
              {sessionsError instanceof CommerceApiError ? sessionsError.message : "Could not load sessions."}
            </p>
          ) : null}
          {sessionRows.map((s) => {
            const loc = [s.ipRegion, s.ipCountry].filter(Boolean).join(", ") || "Unknown location";
            return (
              <div key={s.id} className="flex items-center justify-between py-4 border-b border-outline-variant/10 last:border-0 gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <Icon name="laptop" className="text-on-surface-variant shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.deviceLabel || "Device"}</p>
                    <p className="text-xs text-on-surface-variant">
                      {loc}
                      {s.isCurrent ? <span className="text-secondary font-bold ml-1">— Current</span> : null}
                    </p>
                  </div>
                </div>
                {!s.isCurrent ? (
                  <button
                    type="button"
                    disabled={revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(s.id)}
                    className="text-xs font-bold text-error hover:underline shrink-0"
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   PREFERENCES
───────────────────────────────────────────── */
type PreferencesEntity = {
  orderUpdatesEmailEnabled: boolean;
  shipmentUpdatesEmailEnabled: boolean;
  supportUpdatesEmailEnabled: boolean;
  reviewRemindersEnabled: boolean;
  securityAlertsEmailEnabled: boolean;
  marketingEmailEnabled: boolean;
  marketingSmsEnabled: boolean;
};

export const PreferencesPage = () => {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["account", "preferences"],
    queryFn: async () => {
      const res = await customerBackendApi.getPreferences();
      return (res.data as { entity: PreferencesEntity }).entity;
    }
  });

  const patchMutation = useMutation({
    mutationFn: async (partial: Partial<PreferencesEntity>) => {
      await customerBackendApi.patchPreferences(partial);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account", "preferences"] });
    }
  });

  const rows: Array<{ key: keyof PreferencesEntity; label: string; desc: string }> = [
    {
      key: "orderUpdatesEmailEnabled",
      label: "Order updates",
      desc: "Email when your order status changes"
    },
    {
      key: "shipmentUpdatesEmailEnabled",
      label: "Shipment updates",
      desc: "Email about dispatch and delivery milestones"
    },
    {
      key: "supportUpdatesEmailEnabled",
      label: "Support updates",
      desc: "Email when your support ticket is updated"
    },
    {
      key: "reviewRemindersEnabled",
      label: "Review reminders",
      desc: "Nudges to review eligible purchases"
    },
    {
      key: "securityAlertsEmailEnabled",
      label: "Security alerts",
      desc: "Important account security notices"
    },
    { key: "marketingEmailEnabled", label: "Marketing email", desc: "Sales and product announcements" },
    { key: "marketingSmsEnabled", label: "Marketing SMS", desc: "Occasional SMS offers (carrier rates may apply)" }
  ];

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Preferences</h1>
        <p className="text-on-surface-variant">Manage your notification and communication settings.</p>
      </header>
      {isPending ? <p className="text-on-surface-variant">Loading preferences…</p> : null}
      {error ? (
        <p className="text-error text-sm">{error instanceof CommerceApiError ? error.message : "Could not load preferences."}</p>
      ) : null}
      <div className="max-w-2xl space-y-6">
        {data
          ? rows.map(({ key, label, desc }) => {
              const on = Boolean(data[key]);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 gap-4"
                >
                  <div>
                    <p className="font-headline font-bold">{label}</p>
                    <p className="text-sm text-on-surface-variant">{desc}</p>
                  </div>
                  <button
                    type="button"
                    disabled={patchMutation.isPending}
                    onClick={() => patchMutation.mutate({ [key]: !on } as Partial<PreferencesEntity>)}
                    className={`w-12 h-6 rounded-full relative flex items-center px-1 shrink-0 transition-colors ${
                      on ? "bg-secondary" : "bg-surface-container-high"
                    }`}
                    aria-pressed={on}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${on ? "ml-auto" : ""}`} />
                  </button>
                </div>
              );
            })
          : null}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   ACCOUNT SUPPORT (tickets inside account)
───────────────────────────────────────────── */
export const AccountSupportPage = () => {
  const { data, isPending, error } = useQuery({
    queryKey: ["account", "support", "tickets"],
    queryFn: async () => {
      const res = await customerBackendApi.listSupportTickets({ page: 1, page_size: 50 });
      return (res.data as { items?: unknown[] }).items ?? [];
    }
  });

  const items = (data ?? []) as Array<{
    id: string;
    subject: string | null;
    status: string;
    createdAt: string;
    lastMessageAt: string;
  }>;

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">My Tickets</h1>
        <p className="text-on-surface-variant">Track and manage your open support requests.</p>
      </header>
      {isPending ? <p className="text-on-surface-variant">Loading tickets…</p> : null}
      {error ? (
        <p className="text-error text-sm">{error instanceof CommerceApiError ? error.message : "Could not load tickets."}</p>
      ) : null}
      <div className="space-y-4">
        {items.map((ticket) => (
          <Link
            key={ticket.id}
            to={`/account/support/${ticket.id}`}
            className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 hover:shadow-[0_20px_40px_rgba(11,28,48,0.06)] transition-shadow group"
          >
            <div className="flex-grow">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded ${ticketStatusBadgeClass(ticket.status)}`}>
                  {ticket.status}
                </span>
                <span className="text-xs text-outline">{formatIsoDate(ticket.createdAt)}</span>
              </div>
              <h3 className="font-headline font-bold">{ticket.subject || "Support ticket"}</h3>
              <p className="text-sm text-on-surface-variant">Last activity: {formatIsoDate(ticket.lastMessageAt)}</p>
            </div>
            <Icon name="arrow_forward" className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
        {!isPending && !error && items.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No tickets yet. Open one from Support.</p>
        ) : null}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   ACCOUNT TICKET DETAIL
───────────────────────────────────────────── */
export const AccountTicketDetailPage = () => {
  const { ticketId } = useParams();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const { data, isPending, error } = useQuery({
    queryKey: ["account", "support", "ticket", ticketId],
    queryFn: async () => {
      const res = await customerBackendApi.getSupportTicket(ticketId!);
      return res.data as {
        entity: {
          id: string;
          subject: string | null;
          status: string;
          createdAt: string;
          messages: Array<{ id: string; authorType: string; body: string; createdAt: string }>;
          allowedActions?: { canReply?: boolean };
        };
      };
    },
    enabled: Boolean(ticketId)
  });

  const ticket = data?.entity;

  const replyMutation = useMutation({
    mutationFn: async () => {
      await customerBackendApi.postSupportTicketMessage(ticketId!, { body: reply.trim() });
    },
    onSuccess: async () => {
      setReply("");
      await queryClient.invalidateQueries({ queryKey: ["account", "support", "ticket", ticketId] });
    }
  });

  if (!ticketId) return null;

  if (!isPending && (error || !ticket)) {
    return (
      <AccountLayout>
        <p className="text-on-surface-variant">Ticket not found.</p>
        <Link to="/account/support" className="text-secondary font-bold text-sm mt-4 inline-block hover:underline">
          Back to tickets
        </Link>
      </AccountLayout>
    );
  }

  if (isPending || !ticket) {
    return (
      <AccountLayout>
        <p className="text-on-surface-variant">Loading ticket…</p>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <nav className="flex items-center gap-2 text-xs font-label tracking-widest uppercase text-outline mb-10">
        <Link className="hover:text-secondary transition-colors" to="/account/support">My Tickets</Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <span className="text-on-surface">{ticket.id}</span>
      </nav>
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-extrabold tracking-tighter text-on-background">{ticket.subject || "Support ticket"}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded ${ticketStatusBadgeClass(ticket.status)}`}>
            {ticket.status}
          </span>
          <span className="text-xs text-outline">Opened {formatIsoDate(ticket.createdAt)}</span>
        </div>
      </header>

      <div className="max-w-2xl space-y-4 mb-8">
        {ticket.messages.map((msg) => {
          const isCustomer = msg.authorType === "CUSTOMER";
          return (
            <div
              key={msg.id}
              className={`p-6 rounded-2xl ${
                isCustomer ? "bg-secondary/5 border border-secondary/10" : "bg-surface-container-lowest border border-outline-variant/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-[10px] uppercase tracking-widest font-bold ${
                    isCustomer ? "text-secondary" : "text-on-surface-variant"
                  }`}
                >
                  {isCustomer ? "You" : SUPPORT_SENDER_LABEL}
                </span>
                <span className="text-xs text-outline">{formatIsoDate(msg.createdAt)}</span>
              </div>
              <p className="text-sm text-on-surface leading-relaxed">{msg.body}</p>
            </div>
          );
        })}
      </div>

      {ticket.allowedActions?.canReply ? (
        <div className="max-w-2xl space-y-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className={`w-full resize-none rounded-lg px-4 py-4 ${neutralFieldClass}`}
            rows={4}
            placeholder="Add a reply..."
          />
          {replyMutation.isError ? (
            <p className="text-error text-sm">
              {replyMutation.error instanceof CommerceApiError ? replyMutation.error.message : "Could not send reply."}
            </p>
          ) : null}
          <button
            type="button"
            disabled={replyMutation.isPending || !reply.trim()}
            onClick={() => replyMutation.mutate()}
            className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90 disabled:opacity-60"
          >
            {replyMutation.isPending ? "Sending…" : "Send Reply"}
          </button>
        </div>
      ) : null}
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   SHIPMENT TRACKING DETAIL
───────────────────────────────────────────── */
export const ShipmentTrackingPage = () => {
  const { orderId } = useParams();

  const { data, isPending, error } = useQuery({
    queryKey: ["account", "order", orderId, "tracking"],
    queryFn: async () => {
      const res = await customerBackendApi.getOrderTracking(orderId!);
      return res.data as {
        entity: {
          orderNumber: string;
          status: string;
          shipments: Array<{
            id: string;
            status: string;
            trackingNumber: string | null;
            carrier: string | null;
            trackingEvents: Array<{ statusLabel: string | null; occurredAt: string }>;
          }>;
        };
      };
    },
    enabled: Boolean(orderId)
  });

  const entity = data?.entity;

  if (!orderId) return null;

  if (!isPending && (error || !entity)) {
    return (
      <AccountLayout>
        <header className="mb-8">
          <h1 className="text-3xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Track shipment</h1>
          <p className="text-on-surface-variant mb-6">We could not find that order.</p>
          <Link to="/account/orders" className="text-secondary font-bold hover:underline underline-offset-4">
            Back to order history
          </Link>
        </header>
      </AccountLayout>
    );
  }

  if (isPending || !entity) {
    return (
      <AccountLayout>
        <p className="text-on-surface-variant">Loading tracking…</p>
      </AccountLayout>
    );
  }

  const shipment = entity.shipments[0];
  const events =
    shipment?.trackingEvents?.length ?
      shipment.trackingEvents.map((e) => ({
        label: e.statusLabel || "Update",
        time: formatIsoDate(e.occurredAt),
        done: true
      }))
    : [{ label: "No tracking events yet", time: "", done: false }];

  return (
    <AccountLayout>
      <nav className="flex items-center gap-2 text-xs font-label tracking-widest uppercase text-outline mb-10">
        <Link className="hover:text-secondary transition-colors" to="/account/orders">Orders</Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <Link className="hover:text-secondary transition-colors" to={`/account/orders/${orderId}`}>
          #{entity.orderNumber}
        </Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <span className="text-on-surface">Tracking</span>
      </nav>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Track Shipment</h1>
        <p className="text-on-surface-variant">Order #{entity.orderNumber}</p>
      </header>
      <div className="max-w-2xl space-y-6">
        <div className="bg-surface-container-low p-6 rounded-xl">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="font-headline font-bold">
              Tracking: {shipment?.trackingNumber ?? "Pending"}
            </h3>
            <OrderStatusBadge status={entity.status} />
          </div>
          <p className="text-sm text-on-surface-variant">Carrier: {shipment?.carrier ?? "—"}</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20">
          <h3 className="font-headline font-bold mb-6">Shipment progress</h3>
          {events.map(({ label, time, done }, i, arr) => (
            <div key={`${label}-${i}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done ? "bg-secondary text-white" : "bg-surface-container-high text-outline border-2 border-dashed border-outline-variant"
                  }`}
                >
                  {done ? <Icon name="check" className="text-sm" /> : <Icon name="radio_button_unchecked" className="text-sm" />}
                </div>
                {i < arr.length - 1 ? (
                  <div className={`w-px flex-grow my-1 ${done ? "bg-secondary" : "bg-outline-variant/30"}`} />
                ) : null}
              </div>
              <div className="pb-6">
                <p className={`font-medium text-sm ${done ? "text-on-surface" : "text-outline"}`}>{label}</p>
                {time ? <p className="text-xs text-outline">{time}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   RETURN REQUEST WIZARD
───────────────────────────────────────────── */
type ReturnEligibilityEntity = {
  orderId: string;
  orderNumber: string;
  canReturn: boolean;
  reasonMessage: string | null;
  items: Array<{
    orderItemId: string;
    remainingEligibleQuantity: number;
    canReturn: boolean;
  }>;
};

export const ReturnRequestPage = () => {
  const { orderId } = useParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState("Wrong size");
  const [notes, setNotes] = useState("");

  const { data: eligData, isPending: eligPending, error: eligError } = useQuery({
    queryKey: ["account", "return-eligibility", orderId],
    queryFn: async () => {
      const res = await customerBackendApi.getReturnEligibility(orderId!);
      return (res.data as { entity: ReturnEligibilityEntity }).entity;
    },
    enabled: Boolean(orderId)
  });

  const { data: orderData } = useQuery({
    queryKey: ["account", "order", orderId, "return"],
    queryFn: async () => {
      const res = await customerBackendApi.getOrder(orderId!);
      return (res.data as { entity: OrderDetailEntity }).entity;
    },
    enabled: Boolean(orderId)
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(qtyByItem)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
        .filter((x) => x.quantity > 0);
      if (!orderId || items.length === 0) {
        throw new Error("Select at least one item to return.");
      }
      const customerReason = [reasonCode, notes.trim()].filter(Boolean).join(" — ");
      await customerBackendApi.createReturn(orderId, { customerReason, items });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account", "returns"] });
      setStep(3);
    }
  });

  if (!orderId) return null;

  if (eligPending) {
    return (
      <AccountLayout>
        <p className="text-on-surface-variant">Loading return options…</p>
      </AccountLayout>
    );
  }

  if (eligError || !eligData) {
    return (
      <AccountLayout>
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Request Return</h1>
        </header>
        <div className="max-w-2xl p-6 bg-error-container/20 rounded-xl border border-error/20">
          <p className="font-bold text-on-background mb-2">This order cannot be returned from here</p>
          <p className="text-sm text-on-surface-variant mb-4">
            {eligError instanceof CommerceApiError ? eligError.message : "We could not load return eligibility."}
          </p>
          <Link to="/account/orders" className="text-secondary font-bold text-sm hover:underline underline-offset-4">
            View your orders
          </Link>
        </div>
      </AccountLayout>
    );
  }

  if (!eligData.canReturn) {
    return (
      <AccountLayout>
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Request Return</h1>
        </header>
        <div className="max-w-2xl p-6 bg-error-container/20 rounded-xl border border-error/20">
          <p className="font-bold text-on-background mb-2">Not eligible for return</p>
          <p className="text-sm text-on-surface-variant mb-4">{eligData.reasonMessage ?? "This order is not eligible."}</p>
          <Link to={`/account/orders/${orderId}`} className="text-secondary font-bold text-sm hover:underline underline-offset-4">
            Back to order
          </Link>
        </div>
      </AccountLayout>
    );
  }

  const titleOrder = orderData?.orderNumber ?? eligData.orderNumber;

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Request Return</h1>
        <p className="text-on-surface-variant">
          Order #{titleOrder} · Step {step} of 3
        </p>
      </header>
      <div className="max-w-2xl">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-secondary" : "bg-surface-container-high"}`} />
          ))}
        </div>
        {step === 1 ? (
          <div className="space-y-6">
            <h2 className="font-headline font-bold text-xl">Select items to return</h2>
            {eligData.items
              .filter((i) => i.canReturn && i.remainingEligibleQuantity > 0)
              .map((line) => {
                const productTitle =
                  orderData?.items.find((oi) => oi.id === line.orderItemId)?.productTitle ?? "Order line";
                const qty = qtyByItem[line.orderItemId] ?? 0;
                return (
                  <div
                    key={line.orderItemId}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20"
                  >
                    <div className="flex-1">
                      <p className="font-bold">{productTitle}</p>
                      <p className="text-xs text-outline uppercase tracking-widest mt-1">
                        Up to {line.remainingEligibleQuantity} unit(s)
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                      Qty
                      <input
                        type="number"
                        min={0}
                        max={line.remainingEligibleQuantity}
                        value={qty}
                        onChange={(e) =>
                          setQtyByItem((m) => ({
                            ...m,
                            [line.orderItemId]: Math.min(line.remainingEligibleQuantity, Math.max(0, Number(e.target.value) || 0))
                          }))
                        }
                        className={`w-24 rounded-lg px-3 py-2 ${neutralFieldClass}`}
                      />
                    </label>
                  </div>
                );
              })}
            <button
              type="button"
              onClick={() => setStep(2)}
              className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90"
            >
              Continue
            </button>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="space-y-6">
            <h2 className="font-headline font-bold text-xl">Return reason</h2>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Reason</label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className={`w-full rounded-lg py-3 px-4 ${neutralFieldClass}`}
              >
                <option>Wrong size</option>
                <option>Not as described</option>
                <option>Defective or damaged</option>
                <option>Changed my mind</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Additional notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full resize-none rounded-lg px-4 py-3 ${neutralFieldClass}`}
                rows={4}
                placeholder="Please describe the issue..."
              />
            </div>
            {returnMutation.isError ? (
              <p className="text-error text-sm">
                {returnMutation.error instanceof CommerceApiError
                  ? returnMutation.error.message
                  : returnMutation.error instanceof Error
                    ? returnMutation.error.message
                    : "Return request failed."}
              </p>
            ) : null}
            <div className="flex gap-4">
              <button type="button" onClick={() => setStep(1)} className="text-on-surface-variant font-medium hover:text-on-surface">
                Back
              </button>
              <button
                type="button"
                disabled={returnMutation.isPending}
                onClick={() => returnMutation.mutate()}
                className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90 disabled:opacity-60"
              >
                {returnMutation.isPending ? "Submitting…" : "Submit return"}
              </button>
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="space-y-6">
            <h2 className="font-headline font-bold text-xl">Return submitted</h2>
            <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
              <div className="flex items-center gap-3 text-secondary">
                <Icon name="check_circle" filled />
                <p className="font-bold">Return request recorded</p>
              </div>
              <p className="text-sm text-on-surface-variant">We will email you with next steps when the return is reviewed.</p>
            </div>
            <Link
              to="/account/returns"
              className="inline-block bg-surface-container-high text-on-surface px-8 py-3 rounded-md font-bold hover:bg-surface-container transition-colors"
            >
              View returns
            </Link>
          </div>
        ) : null}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   REVIEW REQUEST WIZARD
───────────────────────────────────────────── */
type ReviewEligibilityItem = {
  orderItemId: string;
  product: { id: string; slug: string; title: string };
  variant: { id: string; sku: string };
  canReview: boolean;
  existingReviewId: string | null;
  existingReviewStatus: string | null;
  reasonCode: string | null;
  reasonMessage: string | null;
};

type ReviewEligibilityEntity = {
  orderId: string;
  orderNumber: string;
  canReview: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
  items: ReviewEligibilityItem[];
};

export const OrderReviewWizardPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: eligData, isPending: eligPending, error: eligError } = useQuery({
    queryKey: ["account", "review-eligibility", orderId],
    queryFn: async () => {
      const res = await customerBackendApi.getOrderReviewEligibility(orderId!);
      return (res.data as { entity: ReviewEligibilityEntity }).entity;
    },
    enabled: Boolean(orderId)
  });

  const { data: orderData } = useQuery({
    queryKey: ["account", "order", orderId, "review"],
    queryFn: async () => {
      const res = await customerBackendApi.getOrder(orderId!);
      return (res.data as { entity: OrderDetailEntity }).entity;
    },
    enabled: Boolean(orderId)
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrderItemId) {
        throw new Error("Select an item to review.");
      }
      await customerBackendApi.createReview({
        orderItemId: selectedOrderItemId,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account", "reviews"] });
      await queryClient.invalidateQueries({ queryKey: ["account", "review-eligibility", orderId] });
      await queryClient.invalidateQueries({ queryKey: ["account", "order", orderId] });
      navigate("/account/reviews", { replace: true });
    }
  });

  if (!orderId) return null;

  if (eligPending) {
    return (
      <AccountLayout>
        <p className="text-on-surface-variant">Loading review options…</p>
      </AccountLayout>
    );
  }

  if (eligError || !eligData) {
    return (
      <AccountLayout>
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Write a review</h1>
        </header>
        <div className="max-w-2xl p-6 bg-error-container/20 rounded-xl border border-error/20">
          {eligError instanceof CommerceApiError ? (
            <p className="text-sm text-on-surface-variant mb-4">{eligError.message}</p>
          ) : null}
          <Link to="/account/orders" className="text-secondary font-bold text-sm hover:underline underline-offset-4">
            View your orders
          </Link>
        </div>
      </AccountLayout>
    );
  }

  if (!eligData.canReview) {
    return (
      <AccountLayout>
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Write a review</h1>
        </header>
        <div className="max-w-2xl p-6 bg-error-container/20 rounded-xl border border-error/20">
          <p className="font-bold text-on-background mb-2">Nothing to review yet</p>
          {typeof eligData.reasonMessage === "string" && eligData.reasonMessage.trim().length > 0 ? (
            <p className="text-sm text-on-surface-variant mb-4">{eligData.reasonMessage}</p>
          ) : null}
          <Link to={`/account/orders/${orderId}`} className="text-secondary font-bold text-sm hover:underline underline-offset-4">
            Back to order
          </Link>
        </div>
      </AccountLayout>
    );
  }

  const eligibleLines = eligData.items.filter((i) => i.canReview);
  const titleOrder = orderData?.orderNumber ?? eligData.orderNumber;
  const selectedLine = eligibleLines.find((l) => l.orderItemId === selectedOrderItemId) ?? null;

  return (
    <AccountLayout>
      <nav className="flex items-center gap-2 text-xs font-label tracking-widest uppercase text-outline mb-10">
        <Link className="hover:text-secondary transition-colors" to="/account/orders">
          Orders
        </Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <Link className="hover:text-secondary transition-colors" to={`/account/orders/${orderId}`}>
          #{titleOrder}
        </Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <span className="text-on-surface">Review</span>
      </nav>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Write a review</h1>
        <p className="text-on-surface-variant">
          Order #{titleOrder} · Step {step} of 2
        </p>
      </header>
      <div className="max-w-2xl">
        <div className="flex gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-secondary" : "bg-surface-container-high"}`} />
          ))}
        </div>
        {step === 1 ? (
          <div className="space-y-6">
            <h2 className="font-headline font-bold text-xl">Choose an item</h2>
            <p className="text-sm text-on-surface-variant">Select one product from this order to review.</p>
            {eligibleLines.map((line) => {
              const productTitle =
                orderData?.items.find((oi) => oi.id === line.orderItemId)?.productTitle ?? line.product.title;
              const checked = selectedOrderItemId === line.orderItemId;
              return (
                <label
                  key={line.orderItemId}
                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                    checked ? "border-secondary bg-secondary/5" : "border-outline-variant/20 bg-surface-container-lowest"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="radio"
                      name="review-order-item"
                      className="mt-1 h-4 w-4 accent-secondary"
                      checked={checked}
                      onChange={() => setSelectedOrderItemId(line.orderItemId)}
                    />
                    <div className="min-w-0">
                      <p className="font-bold">{productTitle}</p>
                      <p className="mt-1 text-xs uppercase tracking-widest text-outline">SKU {line.variant.sku}</p>
                    </div>
                  </div>
                </label>
              );
            })}
            <button
              type="button"
              disabled={!selectedOrderItemId}
              onClick={() => setStep(2)}
              className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="space-y-6">
            <h2 className="font-headline font-bold text-xl">Your review</h2>
            {selectedLine ? (
              <p className="text-sm text-on-surface-variant">
                For: <span className="font-semibold text-on-background">{selectedLine.product.title}</span>
              </p>
            ) : null}
            <div className="space-y-2">
              <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className={`w-full rounded-lg py-3 px-4 ${neutralFieldClass}`}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} — {n === 5 ? "Excellent" : n === 4 ? "Good" : n === 3 ? "OK" : n === 2 ? "Poor" : "Very poor"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Title (optional)
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
                maxLength={255}
                placeholder="Short headline"
              />
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                Comments (optional)
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className={`w-full resize-none rounded-lg px-4 py-3 ${neutralFieldClass}`}
                rows={5}
                maxLength={2000}
                placeholder="Share details about fit, quality, or delivery…"
              />
            </div>
            {reviewMutation.isError && reviewMutation.error instanceof CommerceApiError ? (
              <p className="text-error text-sm">{reviewMutation.error.message}</p>
            ) : null}
            <div className="flex gap-4">
              <button type="button" onClick={() => setStep(1)} className="text-on-surface-variant font-medium hover:text-on-surface">
                Back
              </button>
              <button
                type="button"
                disabled={reviewMutation.isPending || !selectedOrderItemId}
                onClick={() => reviewMutation.mutate()}
                className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90 disabled:opacity-60"
              >
                {reviewMutation.isPending ? "Submitting…" : "Submit review"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AccountLayout>
  );
};
