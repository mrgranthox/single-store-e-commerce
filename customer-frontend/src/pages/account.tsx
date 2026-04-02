import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AccountLayout } from "@/components/layout";
import { OrderStatusBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { orders, tickets } from "@/lib/data/customer-mock";
import { neutralCheckboxClass, neutralFieldClass } from "@/lib/form-field-styles";
import { STORE_NAME_FULL, STORE_NAME_SHORT, SUPPORT_SENDER_LABEL } from "@/lib/brand";
import { useCustomerStore } from "@/lib/store/customer-store";

/* ─────────────────────────────────────────────
   ACCOUNT DASHBOARD
───────────────────────────────────────────── */
export const AccountDashboardPage = () => {
  const wishlistIds = useCustomerStore((s) => s.wishlist);
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "pending").length;

  const quick = [
    { to: "/account/orders", label: "Orders", sub: "Track & returns", icon: "package_2" as const },
    { to: "/wishlist", label: "Wishlist", sub: `${wishlistIds.length} saved`, icon: "favorite" as const },
    { to: "/account/addresses", label: "Addresses", sub: "Shipping book", icon: "home_pin" as const },
    { to: "/account/support", label: "Support", sub: `${openTickets} open`, icon: "support_agent" as const },
  ];

  return (
    <AccountLayout>
      <section className="mb-8 sm:mb-10 rounded-2xl border border-outline-variant/20 bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-secondary/5 p-5 sm:p-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <p className="text-[10px] sm:text-xs font-label font-bold uppercase tracking-[0.2em] text-outline mb-2">Your {STORE_NAME_SHORT}</p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tight text-on-background mb-1">
          Welcome back, Julian
        </h1>
        <p className="text-sm sm:text-base text-on-surface-variant max-w-xl leading-relaxed">
          Premium member · Orders, wishlist, and concierge tools in one place.
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
          { label: "Lifetime orders", value: String(orders.length), hint: "All time" },
          { label: "Wishlist", value: String(wishlistIds.length), hint: "Saved pieces" },
          { label: "Open tickets", value: String(openTickets), hint: "Needs reply" },
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
        {orders.slice(0, 2).map((order) => (
          <div
            key={order.id}
            className="group bg-surface-container-lowest p-4 sm:p-6 rounded-2xl border border-outline-variant/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 hover:border-outline-variant/35 transition-colors"
          >
            <div className="flex gap-4 flex-1 min-w-0">
              <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface-container">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  src={order.items[0].imageUrl}
                  alt={order.items[0].name}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-xs font-medium text-outline">#{order.orderNumber}</span>
                </div>
                <h3 className="text-base sm:text-lg font-headline font-bold text-on-background truncate">{order.items[0].name}</h3>
                <p className="text-xs sm:text-sm text-on-surface-variant">{order.createdAt}</p>
              </div>
            </div>
            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/15 sm:min-w-[7rem]">
              <div className="text-left sm:text-right">
                <p className="text-[10px] uppercase tracking-widest font-bold text-outline mb-0.5">Total</p>
                <p className="text-lg sm:text-2xl font-headline font-extrabold text-on-background tabular-nums">${order.total.toFixed(2)}</p>
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
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   ORDERS LIST — matches order_history/code.html
───────────────────────────────────────────── */
export const OrdersListPage = () => {
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [search, setSearch] = useState("");

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "All Statuses" || o.status === statusFilter;
    const matchSearch = search === "" || o.orderNumber.includes(search) || o.items.some((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  });

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
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`w-full rounded-lg py-3 px-4 font-body text-sm outline-none ${neutralFieldClass}`}
          >
            <option>All Statuses</option>
            <option>Processing</option>
            <option>Shipped</option>
            <option>Delivered</option>
            <option>Returned</option>
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

      {/* Order Cards */}
      <div className="grid grid-cols-1 gap-6">
        {filtered.map((order) => (
          <div key={order.id} className="group bg-surface-container-lowest p-1 rounded-2xl transition-all duration-300 hover:shadow-[0_20px_40px_rgba(11,28,48,0.06)]">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20">
              <div className="flex-shrink-0 w-full lg:w-32 h-32 rounded-xl overflow-hidden bg-surface-container">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  src={order.items[0].imageUrl}
                  alt={order.items[0].name}
                />
              </div>
              <div className="flex-grow mt-6 lg:mt-0 lg:px-8 space-y-1">
                <div className="flex items-center gap-3 mb-2">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-xs font-medium text-outline">Order #{order.orderNumber}</span>
                </div>
                <h3 className="text-xl font-headline font-bold text-on-background">{order.items[0].name}</h3>
                <p className="text-sm text-on-surface-variant font-body">Placed on {order.createdAt}</p>
              </div>
              <div className="mt-6 lg:mt-0 lg:text-right border-t lg:border-t-0 lg:border-l border-outline-variant/20 pt-6 lg:pt-0 lg:pl-12">
                <p className="text-[10px] uppercase tracking-widest font-bold text-outline mb-1">Total</p>
                <p className="text-2xl font-headline font-extrabold text-on-background">${order.total.toFixed(2)}</p>
                <Link
                  to={`/account/orders/${order.id}`}
                  className="inline-flex items-center gap-2 mt-4 text-secondary font-bold text-sm hover:underline underline-offset-4"
                >
                  View Details <Icon name="arrow_forward" className="text-sm" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="mt-16 flex justify-center items-center space-x-4">
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-outline hover:bg-surface-container-high transition-colors">
          <Icon name="chevron_left" />
        </button>
        <div className="flex space-x-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${n === 1 ? "bg-primary text-on-primary" : "text-on-background hover:bg-surface-container-high"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-outline hover:bg-surface-container-high transition-colors">
          <Icon name="chevron_right" />
        </button>
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   ORDER DETAIL
───────────────────────────────────────────── */
export const OrderDetailPage = () => {
  const { orderId } = useParams();
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
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
            <p className="text-sm text-on-surface-variant">{order.createdAt}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {(order.status === "Shipped" || order.status === "Processing") && (
            <Link
              to={`/account/orders/${order.id}/tracking`}
              className="bg-secondary text-on-secondary text-center px-6 py-3 rounded-md font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Track shipment
            </Link>
          )}
          {order.status === "Delivered" && (
            <Link
              to={`/account/orders/${order.id}/return`}
              className="bg-surface-container-high text-on-surface text-center px-6 py-3 rounded-md font-bold text-sm hover:bg-surface-container transition-colors"
            >
              Request return
            </Link>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="font-headline text-xl font-bold">Items</h2>
          {order.items.map((item, i) => (
            <div key={i} className="flex gap-6 p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
              <div className="w-24 h-28 bg-surface-container rounded-xl overflow-hidden flex-shrink-0">
                <img className="w-full h-full object-cover" src={item.imageUrl} alt={item.name} />
              </div>
              <div className="flex flex-col justify-between flex-grow">
                <div>
                  <h3 className="font-headline font-bold text-lg">{item.name}</h3>
                  {item.variant && <p className="text-sm text-on-surface-variant">{item.variant}</p>}
                  <p className="text-sm text-on-surface-variant">Qty: {item.qty}</p>
                </div>
                <p className="font-headline font-bold text-xl">${item.price.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="bg-surface-container-low p-8 rounded-xl">
            <h3 className="font-headline font-bold text-lg mb-6">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-on-surface-variant">Subtotal</span><span>${order.total.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Shipping</span><span className="text-secondary">Free</span></div>
              <div className="flex justify-between border-t border-outline-variant/20 pt-3 font-bold text-base">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-xl space-y-4">
            <h3 className="font-headline font-bold text-lg">Shipping Address</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Julian Archer<br />
              1248 North Highland Ave<br />
              Los Angeles, CA 90038
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
export const ProfilePage = () => (
  <AccountLayout>
    <header className="mb-12">
      <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Profile</h1>
      <p className="text-on-surface-variant">Manage your personal information and preferences.</p>
    </header>
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-6 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20">
        <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center">
          <span className="text-3xl font-headline font-bold text-secondary">JA</span>
        </div>
        <div>
          <h2 className="font-headline font-bold text-xl">Julian Archer</h2>
          <p className="text-on-surface-variant text-sm">Premium Member since 2023</p>
        </div>
        <button className="ml-auto bg-surface-container-high text-on-surface px-4 py-2 rounded-md text-sm font-bold hover:bg-surface-container transition-colors">
          Change Photo
        </button>
      </div>

      <form className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 space-y-6">
        <h2 className="font-headline font-bold text-lg">Personal Information</h2>
        {[
          { label: "First Name", value: "Julian", placeholder: "Julian" },
          { label: "Last Name", value: "Archer", placeholder: "Archer" },
          { label: "Email Address", value: "julian@teescollection.com", type: "email", placeholder: "email@example.com" },
          { label: "Phone Number", value: "+1 (555) 234-5678", type: "tel", placeholder: "+1 (555) 000-0000" },
        ].map(({ label, value, type, placeholder }) => (
          <div key={label} className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{label}</label>
            <input
              defaultValue={value}
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
              type={type ?? "text"}
              placeholder={placeholder}
            />
          </div>
        ))}
        <div className="flex justify-end">
          <button type="submit" className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90 transition-opacity">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </AccountLayout>
);

/* ─────────────────────────────────────────────
   ADDRESSES
───────────────────────────────────────────── */
export const AddressesPage = () => {
  const [showForm, setShowForm] = useState(false);

  return (
    <AccountLayout>
      <header className="mb-12 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Addresses</h1>
          <p className="text-on-surface-variant">Manage your saved shipping addresses.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-secondary text-on-secondary px-6 py-3 rounded-md font-bold hover:opacity-90 transition-opacity">
          <Icon name="add" />
          Add Address
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        {[
          { name: "Home", address: "1248 North Highland Ave, Los Angeles, CA 90038, US", default: true },
          { name: "Office", address: "500 Broadway, Suite 1200, New York, NY 10012, US", default: false },
        ].map(({ name, address, default: isDefault }) => (
          <div key={name} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 relative">
            {isDefault && (
              <span className="absolute top-4 right-4 text-[10px] uppercase tracking-widest font-bold bg-secondary/10 text-secondary px-2 py-1 rounded">
                Default
              </span>
            )}
            <div className="flex items-center gap-3 mb-3">
              <Icon name={name === "Home" ? "home" : "work"} className="text-secondary" />
              <h3 className="font-headline font-bold">{name}</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{address}</p>
            <div className="flex gap-3">
              <button className="text-secondary text-sm font-bold hover:underline">Edit</button>
              {!isDefault && <button className="text-outline text-sm font-bold hover:text-error transition-colors">Delete</button>}
            </div>
          </div>
        ))}

        {showForm && (
          <div className="md:col-span-2 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20">
            <h3 className="font-headline font-bold text-lg mb-6">New Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {["Label", "Full Name", "Address Line 1", "City", "Zip Code", "Country"].map((f) => (
                <div key={f} className={`space-y-2 ${f === "Address Line 1" ? "md:col-span-2" : ""}`}>
                  <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{f}</label>
                  <input className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`} type="text" />
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-6">
              <button className="bg-secondary text-on-secondary px-6 py-3 rounded-md font-bold hover:opacity-90">Save Address</button>
              <button onClick={() => setShowForm(false)} className="text-on-surface-variant font-medium hover:text-on-surface">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   RETURNS LIST
───────────────────────────────────────────── */
export const ReturnsListPage = () => (
  <AccountLayout>
    <header className="mb-12">
      <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Returns</h1>
      <p className="text-on-surface-variant">Manage and track your return requests.</p>
    </header>
    <div className="text-center py-20">
      <Icon name="assignment_return" className="text-6xl text-outline mb-4" />
      <h2 className="font-headline text-xl font-bold mb-3">No returns yet</h2>
      <p className="text-on-surface-variant mb-8">Need to return an item? Start a return from your order details.</p>
      <Link to="/account/orders" className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">
        View Orders
      </Link>
    </div>
  </AccountLayout>
);

/* ─────────────────────────────────────────────
   REFUNDS LIST
───────────────────────────────────────────── */
export const RefundsListPage = () => (
  <AccountLayout>
    <header className="mb-12">
      <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Refunds</h1>
      <p className="text-on-surface-variant">Track your refund requests and payment reversals.</p>
    </header>
    <div className="text-center py-20">
      <Icon name="payments" className="text-6xl text-outline mb-4" />
      <h2 className="font-headline text-xl font-bold mb-3">No refunds yet</h2>
      <p className="text-on-surface-variant mb-8">Refunds typically process within 5-7 business days.</p>
    </div>
  </AccountLayout>
);

/* ─────────────────────────────────────────────
   REVIEWS CENTER
───────────────────────────────────────────── */
export const ReviewsCenterPage = () => {
  const [rating, setRating] = useState(5);

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Reviews</h1>
        <p className="text-on-surface-variant">Share your experience to help the community.</p>
      </header>
      <div className="max-w-2xl">
        <h2 className="font-headline font-bold text-lg mb-6">Pending Reviews</h2>
        {orders.filter((o) => o.status === "Delivered").map((order) => (
          <div key={order.id} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 mb-4">
            <div className="flex gap-4 mb-6">
              <div className="w-16 h-20 bg-surface-container rounded-lg overflow-hidden">
                <img className="w-full h-full object-cover" src={order.items[0].imageUrl} alt={order.items[0].name} />
              </div>
              <div>
                <h3 className="font-headline font-bold">{order.items[0].name}</h3>
                <p className="text-sm text-on-surface-variant">Order #{order.orderNumber}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block mb-2">Your Rating</label>
                <div className="flex gap-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <button key={i} onClick={() => setRating(i + 1)}>
                      <span className="material-symbols-outlined text-2xl text-tertiary" style={{ fontVariationSettings: `'FILL' ${i < rating ? 1 : 0}, 'wght' 400` }}>star</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block mb-2">Review</label>
                <textarea className={`w-full resize-none rounded-lg px-4 py-3 ${neutralFieldClass}`} rows={4} placeholder="Share your experience with this product..." />
              </div>
              <button className="bg-secondary text-on-secondary px-6 py-3 rounded-md font-bold hover:opacity-90">Submit Review</button>
            </div>
          </div>
        ))}
      </div>
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   SECURITY & SESSIONS
───────────────────────────────────────────── */
export const SecurityPage = () => (
  <AccountLayout>
    <header className="mb-12">
      <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Security</h1>
      <p className="text-on-surface-variant">Manage your password and active sessions.</p>
    </header>
    <div className="max-w-2xl space-y-8">
      <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 space-y-6">
        <h2 className="font-headline font-bold text-lg">Change Password</h2>
        {["Current Password", "New Password", "Confirm New Password"].map((label) => (
          <div key={label} className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{label}</label>
            <input className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`} type="password" placeholder="••••••••" />
          </div>
        ))}
        <button className="bg-secondary text-on-secondary px-6 py-3 rounded-md font-bold hover:opacity-90">Update Password</button>
      </div>
      <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20">
        <h2 className="font-headline font-bold text-lg mb-6">Active Sessions</h2>
        {[
          { device: "Chrome — macOS", location: "Los Angeles, US", current: true },
          { device: "Safari — iPhone 14", location: "Los Angeles, US", current: false },
        ].map(({ device, location, current }) => (
          <div key={device} className="flex items-center justify-between py-4 border-b border-outline-variant/10 last:border-0">
            <div className="flex items-center gap-4">
              <Icon name={device.includes("iPhone") ? "smartphone" : "laptop"} className="text-on-surface-variant" />
              <div>
                <p className="font-medium text-sm">{device}</p>
                <p className="text-xs text-on-surface-variant">{location} {current && <span className="text-secondary font-bold ml-1">— Current</span>}</p>
              </div>
            </div>
            {!current && <button className="text-xs font-bold text-error hover:underline">Revoke</button>}
          </div>
        ))}
      </div>
    </div>
  </AccountLayout>
);

/* ─────────────────────────────────────────────
   PREFERENCES
───────────────────────────────────────────── */
export const PreferencesPage = () => (
  <AccountLayout>
    <header className="mb-12">
      <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Preferences</h1>
      <p className="text-on-surface-variant">Manage your notification and communication settings.</p>
    </header>
    <div className="max-w-2xl space-y-6">
      {[
        { label: "Order Updates", desc: "Receive email when your order status changes" },
        { label: "Promotional Offers", desc: "Get notified about sales and exclusive deals" },
        { label: "New Arrivals", desc: "Be the first to know about new collections" },
        { label: "Restocks", desc: "Get alerts when wishlisted items come back in stock" },
      ].map(({ label, desc }) => (
        <div key={label} className="flex items-center justify-between p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
          <div>
            <p className="font-headline font-bold">{label}</p>
            <p className="text-sm text-on-surface-variant">{desc}</p>
          </div>
          <button className="w-12 h-6 bg-secondary rounded-full relative flex items-center px-1">
            <div className="w-4 h-4 bg-white rounded-full ml-auto" />
          </button>
        </div>
      ))}
    </div>
  </AccountLayout>
);

/* ─────────────────────────────────────────────
   ACCOUNT SUPPORT (tickets inside account)
───────────────────────────────────────────── */
export const AccountSupportPage = () => (
  <AccountLayout>
    <header className="mb-12">
      <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">My Tickets</h1>
      <p className="text-on-surface-variant">Track and manage your open support requests.</p>
    </header>
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <Link
          key={ticket.id}
          to={`/account/support/${ticket.id}`}
          className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 hover:shadow-[0_20px_40px_rgba(11,28,48,0.06)] transition-shadow group"
        >
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded ${
                ticket.status === "open" ? "bg-error/10 text-error" :
                ticket.status === "resolved" ? "bg-secondary/10 text-secondary" :
                "bg-surface-container-high text-on-surface-variant"
              }`}>
                {ticket.status}
              </span>
              <span className="text-xs text-outline">{ticket.createdAt}</span>
            </div>
            <h3 className="font-headline font-bold">{ticket.subject}</h3>
            <p className="text-sm text-on-surface-variant">Last reply: {ticket.lastReply}</p>
          </div>
          <Icon name="arrow_forward" className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
    </div>
  </AccountLayout>
);

/* ─────────────────────────────────────────────
   ACCOUNT TICKET DETAIL
───────────────────────────────────────────── */
export const AccountTicketDetailPage = () => {
  const { ticketId } = useParams();
  const ticket = tickets.find((t) => t.id === ticketId) ?? tickets[0];

  return (
    <AccountLayout>
      <nav className="flex items-center gap-2 text-xs font-label tracking-widest uppercase text-outline mb-10">
        <Link className="hover:text-secondary transition-colors" to="/account/support">My Tickets</Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <span className="text-on-surface">{ticket.id}</span>
      </nav>
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-extrabold tracking-tighter text-on-background">{ticket.subject}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded ${ticket.status === "open" ? "bg-error/10 text-error" : "bg-secondary/10 text-secondary"}`}>
            {ticket.status}
          </span>
          <span className="text-xs text-outline">Opened {ticket.createdAt}</span>
        </div>
      </header>

      <div className="max-w-2xl space-y-4 mb-8">
        {ticket.messages.map((msg, i) => (
          <div
            key={i}
            className={`p-6 rounded-2xl ${msg.sender === "customer" ? "bg-secondary/5 border border-secondary/10" : "bg-surface-container-lowest border border-outline-variant/20"}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] uppercase tracking-widest font-bold ${msg.sender === "customer" ? "text-secondary" : "text-on-surface-variant"}`}>
                {msg.sender === "customer" ? "You" : SUPPORT_SENDER_LABEL}
              </span>
              <span className="text-xs text-outline">{msg.time}</span>
            </div>
            <p className="text-sm text-on-surface leading-relaxed">{msg.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "resolved" && (
        <div className="max-w-2xl space-y-4">
          <textarea
            className={`w-full resize-none rounded-lg px-4 py-4 ${neutralFieldClass}`}
            rows={4}
            placeholder="Add a reply..."
          />
          <button className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">Send Reply</button>
        </div>
      )}
    </AccountLayout>
  );
};

/* ─────────────────────────────────────────────
   SHIPMENT TRACKING DETAIL
───────────────────────────────────────────── */
export const ShipmentTrackingPage = () => {
  const { orderId } = useParams();
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
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

  const primaryItem = order.items[0];

  return (
  <AccountLayout>
    <nav className="flex items-center gap-2 text-xs font-label tracking-widest uppercase text-outline mb-10">
      <Link className="hover:text-secondary transition-colors" to="/account/orders">Orders</Link>
      <Icon name="chevron_right" className="text-[10px]" />
      <Link className="hover:text-secondary transition-colors" to={`/account/orders/${order.id}`}>
        #{order.orderNumber}
      </Link>
      <Icon name="chevron_right" className="text-[10px]" />
      <span className="text-on-surface">Tracking</span>
    </nav>
    <header className="mb-12">
      <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Track Shipment</h1>
      <p className="text-on-surface-variant">
        Order #{order.orderNumber}
        {primaryItem ? ` — ${primaryItem.name}` : ""}
      </p>
    </header>
    <div className="max-w-2xl space-y-6">
      <div className="bg-surface-container-low p-6 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-headline font-bold">Tracking: FX28930482</h3>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-on-surface-variant">Carrier: FedEx Express</p>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20">
        <h3 className="font-headline font-bold mb-6">Shipment Progress</h3>
        {[
          { label: "Order Placed", time: "Nov 2, 9:01 AM", done: true },
          { label: "Order Processed", time: "Nov 2, 2:15 PM", done: true },
          { label: "Shipped from Warehouse", time: "Nov 3, 7:00 AM", done: true },
          { label: "In Transit", time: "Nov 4, 6:23 PM", done: false },
          { label: "Out for Delivery", time: "Expected Nov 6", done: false },
          { label: "Delivered", time: "Expected Nov 6", done: false },
        ].map(({ label, time, done }, i, arr) => (
          <div key={label} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-secondary text-white" : "bg-surface-container-high text-outline border-2 border-dashed border-outline-variant"}`}>
                {done ? <Icon name="check" className="text-sm" /> : <Icon name="radio_button_unchecked" className="text-sm" />}
              </div>
              {i < arr.length - 1 && <div className={`w-px flex-grow my-1 ${done ? "bg-secondary" : "bg-outline-variant/30"}`} />}
            </div>
            <div className="pb-6">
              <p className={`font-medium text-sm ${done ? "text-on-surface" : "text-outline"}`}>{label}</p>
              <p className="text-xs text-outline">{time}</p>
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
export const ReturnRequestPage = () => {
  const { orderId } = useParams();
  const [step, setStep] = useState(1);

  const scopedOrder = orderId ? orders.find((o) => o.id === orderId) : undefined;
  const eligibleOrders = orders.filter((o) => o.status === "Delivered");
  const ordersForItems =
    orderId && scopedOrder
      ? scopedOrder.status === "Delivered"
        ? [scopedOrder]
        : []
      : eligibleOrders;

  const invalidScopedOrder = Boolean(orderId) && (!scopedOrder || scopedOrder.status !== "Delivered");

  if (invalidScopedOrder) {
    return (
      <AccountLayout>
        <header className="mb-8">
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Request Return</h1>
        </header>
        <div className="max-w-2xl p-6 bg-error-container/20 rounded-xl border border-error/20">
          <p className="font-bold text-on-background mb-2">This order cannot be returned from here</p>
          <p className="text-sm text-on-surface-variant mb-4">
            {scopedOrder ? "Returns are only available for delivered orders." : "We could not find that order."}
          </p>
          <Link to="/account/orders" className="text-secondary font-bold text-sm hover:underline underline-offset-4">
            View your orders
          </Link>
        </div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Request Return</h1>
        <p className="text-on-surface-variant">
          {scopedOrder && scopedOrder.status === "Delivered"
            ? `Order #${scopedOrder.orderNumber} · Step ${step} of 3`
            : `Step ${step} of 3`}
        </p>
      </header>
      <div className="max-w-2xl">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-secondary" : "bg-surface-container-high"}`} />
          ))}
        </div>
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="font-headline font-bold text-xl">Select items to return</h2>
            {ordersForItems.length === 0 && !invalidScopedOrder && (
              <p className="text-on-surface-variant text-sm">No delivered orders are eligible for return yet.</p>
            )}
            {ordersForItems.flatMap((o) =>
              o.items.map((item, i) => (
                <label
                  key={`${o.id}-${i}`}
                  className="flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 cursor-pointer hover:border-secondary/30 transition-colors"
                >
                  <input type="checkbox" className={`h-5 w-5 ${neutralCheckboxClass}`} />
                  <div className="w-16 h-20 bg-surface-container rounded-lg overflow-hidden">
                    <img className="w-full h-full object-cover" src={item.imageUrl} alt={item.name} />
                  </div>
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-xs text-outline uppercase tracking-widest mb-1">Order #{o.orderNumber}</p>
                    <p className="text-sm text-on-surface-variant">${item.price.toFixed(2)}</p>
                  </div>
                </label>
              ))
            )}
            <button onClick={() => setStep(2)} className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">
              Continue
            </button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="font-headline font-bold text-xl">Return Reason</h2>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Reason</label>
              <select className={`w-full rounded-lg py-3 px-4 ${neutralFieldClass}`}>
                <option>Wrong size</option>
                <option>Not as described</option>
                <option>Defective or damaged</option>
                <option>Changed my mind</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Additional Notes</label>
              <textarea className={`w-full resize-none rounded-lg px-4 py-3 ${neutralFieldClass}`} rows={4} placeholder="Please describe the issue..." />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="text-on-surface-variant font-medium hover:text-on-surface">Back</button>
              <button onClick={() => setStep(3)} className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">Continue</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="font-headline font-bold text-xl">Confirm Return</h2>
            <div className="bg-surface-container-low p-6 rounded-xl space-y-4">
              <div className="flex items-center gap-3 text-secondary">
                <Icon name="check_circle" filled />
                <p className="font-bold">Return request submitted</p>
              </div>
              <p className="text-sm text-on-surface-variant">
                A prepaid return label has been sent to your email. Pack the item securely and drop it at any carrier location within 14 days.
              </p>
            </div>
            <Link to="/account/orders" className="inline-block bg-surface-container-high text-on-surface px-8 py-3 rounded-md font-bold hover:bg-surface-container transition-colors">
              Back to Orders
            </Link>
          </div>
        )}
      </div>
    </AccountLayout>
  );
};
