import type React from "react";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { LOGO_ALT, LOGO_SRC, STORE_NAME_FULL, STORE_NAME_SHORT } from "@/lib/brand";
import { neutralFieldClass } from "@/lib/form-field-styles";
import { useCustomerStore } from "@/lib/store/customer-store";

const topNavIconBtn =
  "inline-flex items-center justify-center size-10 sm:size-11 rounded-xl text-on-surface hover:bg-surface-container-low hover:text-secondary active:scale-[0.97] transition-all outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const drawerLinkBase =
  "flex items-center gap-3 py-3 px-3 rounded-xl text-sm font-headline font-semibold transition-colors";

const drawerLinkIdle = `${drawerLinkBase} text-on-surface hover:bg-surface-container-low`;

const drawerLinkActive = `${drawerLinkBase} bg-secondary/10 text-secondary`;

const drawerSectionLabel = "px-3 pt-5 pb-1 text-[10px] font-label font-bold uppercase tracking-[0.2em] text-outline first:pt-2";

/** Top offset + bottom safe area for scroll region (no horizontal padding — use for full-bleed home hero) */
export const storefrontScrollRegionClasses =
  "flex-1 w-full min-w-0 pt-[calc(4rem+env(safe-area-inset-top,0px))] md:pt-20 pb-mobile-nav";

/** Shared main padding under fixed top nav + space above bottom nav (mobile) */
export const storefrontMainClasses = `${storefrontScrollRegionClasses} px-4 sm:px-6 md:px-8`;

/** Logo + wordmark — short name on small screens, full name from `sm`. */
export const StoreBrandLink = ({
  to = "/",
  onClick,
  className = "",
  wordmarkClassName = "text-on-background",
}: {
  to?: string;
  onClick?: () => void;
  className?: string;
  /** Applied to the text span(s) next to the logo (default matches main nav). */
  wordmarkClassName?: string;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-2 min-w-0 shrink-0 ${className}`.trim()}
  >
    <img
      src={LOGO_SRC}
      alt={LOGO_ALT}
      className="h-7 w-auto sm:h-8 md:h-9 object-contain rounded-xl"
      width={120}
      height={40}
    />
    <span
      className={`font-headline text-base sm:text-lg md:text-xl font-extrabold tracking-tighter truncate ${wordmarkClassName}`.trim()}
    >
      <span className="sm:hidden">{STORE_NAME_SHORT}</span>
      <span className="hidden sm:inline">{STORE_NAME_FULL}</span>
    </span>
  </Link>
);

/* ─────────────────────────────────────────────
   STOREFRONT CHROME — top nav, footer, bottom tabs (mobile)
───────────────────────────────────────────── */
export const StorefrontShell = ({ children }: React.PropsWithChildren) => (
  <div className="min-h-dvh flex flex-col bg-surface text-on-background font-body">
    <TopNavBar />
    {children}
    <Footer />
    <BottomNavBar />
  </div>
);

export const StorefrontMain = ({
  children,
  className = "",
  maxWidth = true,
}: React.PropsWithChildren<{ className?: string; maxWidth?: boolean }>) => (
  <main
    className={`${storefrontMainClasses} ${maxWidth ? "max-w-screen-2xl mx-auto" : ""} ${className}`.trim()}
  >
    {children}
  </main>
);

/* ─────────────────────────────────────────────
   TOPNAVBAR — desktop: home_page; mobile: compact bar + drawer
───────────────────────────────────────────── */
export const TopNavBar = () => {
  const cartCount = useCustomerStore((s) => s.cart.reduce((sum, item) => sum + item.quantity, 0));
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  const signOut = useCustomerStore((s) => s.signOut);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
    `relative py-2 text-sm font-headline font-semibold tracking-tight transition-colors border-b-2 ${
      isActive
        ? "text-secondary border-secondary"
        : "text-on-surface-variant border-transparent hover:text-on-surface hover:border-outline-variant/40"
    }`;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 safe-area-pt">
        <nav
          className="border-b border-outline-variant/25 bg-surface/88 backdrop-blur-xl shadow-[0_1px_0_rgba(11,28,48,0.04)] no-line tonal-shift"
          aria-label="Main"
        >
          <div className="flex items-center justify-between gap-3 w-full min-h-[3.5rem] sm:min-h-16 px-3 sm:px-6 md:px-8 max-w-screen-2xl mx-auto py-2 sm:py-3">
            {/* Left: menu + brand */}
            <div className="flex items-center gap-1 sm:gap-3 min-w-0 shrink-0">
              <button
                type="button"
                className={`md:hidden ${topNavIconBtn}`}
                aria-expanded={menuOpen}
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                <Icon name="menu" className="text-[22px]" />
              </button>
              <StoreBrandLink to="/" onClick={closeMenu} className="pr-1" />
            </div>

            {/* Center: primary destinations (desktop) */}
            <div className="hidden md:flex flex-1 justify-center items-center min-w-0 px-2 lg:px-4">
              <div className="flex items-center gap-5 lg:gap-8">
                <NavLink to="/shop" className={desktopNavClass}>
                  Shop
                </NavLink>
                <NavLink to="/categories/apparel" className={desktopNavClass}>
                  Categories
                </NavLink>
                <NavLink to="/brands" className={desktopNavClass}>
                  Brands
                </NavLink>
                <NavLink to="/campaigns/the-winter-edit" className={desktopNavClass}>
                  Sale
                </NavLink>
              </div>
            </div>

            {/* Right: search (all breakpoints) + wishlist / bag / account icons (tablet/desktop only — mobile uses bottom nav + drawer) */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 min-w-0">
              <div className="relative w-full max-w-[10.5rem] sm:max-w-xs md:max-w-[13rem] lg:w-56 xl:w-64 lg:max-w-none min-w-0">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-outline text-sm sm:text-base"
                />
                <input
                  className={`w-full rounded-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-1.5 sm:py-2.5 text-xs sm:text-sm transition-colors ${neutralFieldClass}`}
                  placeholder="Search…"
                  type="search"
                  aria-label="Search catalogue"
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      navigate(`/search?query=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
                  }}
                />
              </div>
              <div
                className="hidden md:flex items-center gap-0.5 rounded-2xl bg-surface-container-low/90 border border-outline-variant/15 p-0.5 shrink-0"
                aria-label="Quick links"
              >
                <Link to="/wishlist" className={topNavIconBtn} aria-label="Wishlist">
                  <Icon name="favorite" className="text-[22px]" />
                </Link>
                <Link to="/cart" className={`${topNavIconBtn} relative`} aria-label="Shopping bag">
                  <Icon name="shopping_bag" className="text-[22px]" />
                  {cartCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[1.125rem] h-[1.125rem] px-0.5 bg-secondary text-on-secondary text-[9px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>
                <Link to="/account" className={topNavIconBtn} aria-label="Account">
                  <Icon name="person" className="text-[22px]" />
                </Link>
                {isAuthenticated && (
                  <button
                    type="button"
                    className={topNavIconBtn}
                    aria-label="Sign out"
                    onClick={signOut}
                  >
                    <Icon name="logout" className="text-[22px]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Site menu">
          <button
            type="button"
            className="absolute inset-0 bg-primary-container/45 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div className="absolute top-0 left-0 bottom-0 w-[min(100%,19.5rem)] flex flex-col safe-area-pt bg-surface-container-lowest shadow-[4px_0_48px_rgba(11,28,48,0.12)] border-r border-outline-variant/20">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-outline-variant/20 bg-surface/80">
              <span className="font-headline font-extrabold text-base text-on-background tracking-tight">Browse</span>
              <button
                type="button"
                className={`${topNavIconBtn} size-9`}
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <Icon name="close" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 pb-6">
              <p className={drawerSectionLabel}>Shop</p>
              <NavLink to="/shop" onClick={closeMenu} className={({ isActive }) => (isActive ? drawerLinkActive : drawerLinkIdle)}>
                {({ isActive }) => (
                  <>
                    <Icon name="storefront" className={`text-xl shrink-0 ${isActive ? "text-secondary" : "text-outline"}`} />
                    Shop all
                  </>
                )}
              </NavLink>
              <NavLink
                to="/categories/apparel"
                onClick={closeMenu}
                className={({ isActive }) => (isActive ? drawerLinkActive : drawerLinkIdle)}
              >
                {({ isActive }) => (
                  <>
                    <Icon name="category" className={`text-xl shrink-0 ${isActive ? "text-secondary" : "text-outline"}`} />
                    Categories
                  </>
                )}
              </NavLink>
              <Link to="/brands" onClick={closeMenu} className={drawerLinkIdle}>
                <Icon name="style" className="text-outline text-xl shrink-0" />
                All brands
              </Link>
              <NavLink
                to="/campaigns/the-winter-edit"
                onClick={closeMenu}
                className={({ isActive }) => (isActive ? drawerLinkActive : drawerLinkIdle)}
              >
                {({ isActive }) => (
                  <>
                    <Icon name="sell" className={`text-xl shrink-0 ${isActive ? "text-secondary" : "text-outline"}`} />
                    Sale
                  </>
                )}
              </NavLink>
              <Link to="/wishlist" onClick={closeMenu} className={drawerLinkIdle}>
                <Icon name="favorite" className="text-outline text-xl shrink-0" />
                Wishlist
              </Link>
              <Link to="/saved-items" onClick={closeMenu} className={drawerLinkIdle}>
                <Icon name="bookmark" className="text-outline text-xl shrink-0" />
                Saved &amp; recent
              </Link>

              <p className={drawerSectionLabel}>Help</p>
              <Link to="/support" onClick={closeMenu} className={drawerLinkIdle}>
                <Icon name="contact_support" className="text-outline text-xl shrink-0" />
                Support hub
              </Link>
              <Link to="/help" onClick={closeMenu} className={drawerLinkIdle}>
                <Icon name="quiz" className="text-outline text-xl shrink-0" />
                FAQ
              </Link>
              <Link to="/track-order" onClick={closeMenu} className={drawerLinkIdle}>
                <Icon name="local_shipping" className="text-outline text-xl shrink-0" />
                Track order
              </Link>
              <Link to="/contact" onClick={closeMenu} className={drawerLinkIdle}>
                <Icon name="mail" className="text-outline text-xl shrink-0" />
                Contact
              </Link>
              <Link to="/about" onClick={closeMenu} className={drawerLinkIdle}>
                <Icon name="info" className="text-outline text-xl shrink-0" />
                About
              </Link>

              <p className={drawerSectionLabel}>Account</p>
              {isAuthenticated ? (
                <>
                  <Link to="/account" onClick={closeMenu} className={`${drawerLinkBase} text-secondary bg-secondary/5 hover:bg-secondary/10`}>
                    <Icon name="person" className="text-xl shrink-0" />
                    My account
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      closeMenu();
                    }}
                    className={drawerLinkIdle}
                  >
                    <Icon name="logout" className="text-outline text-xl shrink-0" />
                    Sign out
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={closeMenu} className={`${drawerLinkBase} text-secondary bg-secondary/5 hover:bg-secondary/10`}>
                  <Icon name="login" className="text-xl shrink-0" />
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
};

/* ─────────────────────────────────────────────
   FOOTER — matches home_page/code.html exactly
───────────────────────────────────────────── */
export const Footer = () => (
  <footer className="bg-surface-container-low border-t border-outline-variant/25 w-full mt-12 sm:mt-20 pb-28 md:pb-12 pt-12 sm:pt-16 text-on-background">
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-12">
      <div className="col-span-2 lg:col-span-1">
        <div className="flex items-center gap-2 mb-4">
          <img src={LOGO_SRC} alt={LOGO_ALT} className="h-9 w-auto object-contain rounded-xl" width={120} height={40} />
          <span className="text-lg font-headline font-extrabold tracking-tight text-on-background">{STORE_NAME_FULL}</span>
        </div>
        <p className="text-on-surface-variant text-xs tracking-wide leading-relaxed max-w-xs">
          Curated tees and everyday staples — quality fabrics, fair fits, and styles you will wear on repeat.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <h4 className="font-headline font-bold text-sm text-on-background mb-2">Shop</h4>
        <Link className="text-xs tracking-wide uppercase text-on-surface-variant hover:text-secondary underline-offset-4 decoration-secondary/50 hover:underline transition-colors" to="/shop">New Arrivals</Link>
        <Link className="text-xs tracking-wide uppercase text-on-surface-variant hover:text-secondary underline-offset-4 decoration-secondary/50 hover:underline transition-colors" to="/shop">Best Sellers</Link>
        <Link className="text-xs tracking-wide uppercase text-on-surface-variant hover:text-secondary underline-offset-4 decoration-secondary/50 hover:underline transition-colors" to="/brands">Brands</Link>
        <Link className="text-xs tracking-wide uppercase text-on-surface-variant hover:text-secondary underline-offset-4 decoration-secondary/50 hover:underline transition-colors" to="/campaigns/the-winter-edit">Sale</Link>
      </div>
      <div className="flex flex-col gap-4">
        <h4 className="font-headline font-bold text-sm text-on-background mb-2">Support</h4>
        <Link className="text-xs tracking-wide uppercase text-on-surface-variant hover:text-secondary underline-offset-4 decoration-secondary/50 hover:underline transition-colors" to="/help">Help & Contact</Link>
        <Link className="text-xs tracking-wide uppercase text-on-surface-variant hover:text-secondary underline-offset-4 decoration-secondary/50 hover:underline transition-colors" to="/pages/shipping-policy">Shipping & Returns</Link>
      </div>
      <div className="flex flex-col gap-4">
        <h4 className="font-headline font-bold text-sm text-on-background mb-2">Legal</h4>
        <Link className="text-xs tracking-wide uppercase text-on-surface-variant hover:text-secondary underline-offset-4 decoration-secondary/50 hover:underline transition-colors" to="/pages/privacy-policy">Privacy Policy</Link>
        <Link className="text-xs tracking-wide uppercase text-on-surface-variant hover:text-secondary underline-offset-4 decoration-secondary/50 hover:underline transition-colors" to="/pages/terms">Terms of Service</Link>
      </div>
      <div className="col-span-2 md:col-span-1">
        <h4 className="font-headline font-bold text-sm text-on-background mb-6">Stay Connected</h4>
        <div className="flex gap-2">
          <input
            className={`rounded-md px-4 py-2 text-xs w-full ${neutralFieldClass}`}
            placeholder="Your email"
            type="email"
          />
          <button type="button" className="bg-secondary text-on-secondary px-4 py-2 rounded-md font-bold material-symbols-outlined shrink-0" aria-label="Subscribe">
            send
          </button>
        </div>
      </div>
    </div>
    <div className="h-px w-full max-w-screen-2xl mx-auto my-8 bg-outline-variant/30" />
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
      <p className="text-xs tracking-wide uppercase text-on-surface-variant text-center md:text-left">
        © 2024 {STORE_NAME_FULL}. All rights reserved.
      </p>
      <div className="flex gap-6 text-outline">
        <Icon name="public" className="text-lg" />
        <Icon name="credit_card" className="text-lg" />
        <Icon name="shopping_basket" className="text-lg" />
      </div>
    </div>
  </footer>
);

/* ─────────────────────────────────────────────
   MOBILE BOTTOM NAV — token-aligned tab bar
───────────────────────────────────────────── */
export const BottomNavBar = () => {
  const cartCount = useCustomerStore((s) => s.cart.reduce((sum, item) => sum + item.quantity, 0));

  const scrollTabToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  const tabWrap = (active: boolean) =>
    `flex flex-col items-center justify-center min-w-0 flex-1 gap-0.5 pt-1 pb-1 rounded-xl transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-secondary/35 focus-visible:ring-inset ${
      active
        ? "text-secondary bg-secondary/[0.12]"
        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/80 active:bg-surface-container-high/60"
    }`;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-outline-variant/30 bg-surface-container-lowest/92 backdrop-blur-xl shadow-[0_-12px_40px_rgba(11,28,48,0.07)]"
      aria-label="Primary"
    >
      <div className="mx-auto max-w-screen-sm flex items-stretch justify-between gap-0.5 px-1.5 pt-1.5 pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))] min-h-[3.75rem]">
        <NavLink to="/" end onClick={scrollTabToTop} className={({ isActive }) => tabWrap(isActive)}>
          {({ isActive }) => (
            <>
              <span
                className={`h-0.5 w-5 rounded-full mb-0.5 transition-opacity ${isActive ? "bg-secondary opacity-100" : "opacity-0"}`}
                aria-hidden
              />
              <Icon name="home" filled={isActive} className="text-[24px] -mt-1" />
              <span className="font-label text-[7px] font-bold tracking-[0.12em] uppercase leading-none">Home</span>
            </>
          )}
        </NavLink>
        <NavLink to="/shop" onClick={scrollTabToTop} className={({ isActive }) => tabWrap(isActive)}>
          {({ isActive }) => (
            <>
              <span
                className={`h-0.5 w-5 rounded-full mb-0.5 transition-opacity ${isActive ? "bg-secondary opacity-100" : "opacity-0"}`}
                aria-hidden
              />
              <Icon name="storefront" filled={isActive} className="text-[24px] -mt-1" />
              <span className="font-label text-[7px] font-bold tracking-[0.12em] uppercase leading-none">Shop</span>
            </>
          )}
        </NavLink>
        <NavLink to="/search" onClick={scrollTabToTop} className={({ isActive }) => tabWrap(isActive)}>
          {({ isActive }) => (
            <>
              <span
                className={`h-0.5 w-5 rounded-full mb-0.5 transition-opacity ${isActive ? "bg-secondary opacity-100" : "opacity-0"}`}
                aria-hidden
              />
              <Icon name="search" filled={isActive} className="text-[24px] -mt-1" />
              <span className="font-label text-[7px] font-bold tracking-[0.12em] uppercase leading-none">Search</span>
            </>
          )}
        </NavLink>
        <NavLink to="/cart" onClick={scrollTabToTop} className={({ isActive }) => tabWrap(isActive)}>
          {({ isActive }) => (
            <>
              <span
                className={`h-0.5 w-5 rounded-full mb-0.5 transition-opacity ${isActive ? "bg-secondary opacity-100" : "opacity-0"}`}
                aria-hidden
              />
              <span className="relative inline-flex -mt-1">
                <Icon name="shopping_bag" filled={isActive} className="text-[24px]" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-1 min-w-[15px] h-[15px] px-0.5 bg-secondary text-on-secondary text-[8px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </span>
              <span className="font-label text-[7px] font-bold tracking-[0.12em] uppercase leading-none">Bag</span>
            </>
          )}
        </NavLink>
        <NavLink to="/account" onClick={scrollTabToTop} className={({ isActive }) => tabWrap(isActive)}>
          {({ isActive }) => (
            <>
              <span
                className={`h-0.5 w-5 rounded-full mb-0.5 transition-opacity ${isActive ? "bg-secondary opacity-100" : "opacity-0"}`}
                aria-hidden
              />
              <Icon name="person" filled={isActive} className="text-[24px] -mt-1" />
              <span className="font-label text-[7px] font-bold tracking-[0.12em] uppercase leading-none">You</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
};

/* ─────────────────────────────────────────────
   CHECKOUT HEADER — matches checkout_shipping
───────────────────────────────────────────── */
export const CheckoutHeader = () => (
  <header className="sticky top-0 z-50 safe-area-pt border-b border-outline-variant/25 bg-surface/92 backdrop-blur-xl shadow-[0_1px_0_rgba(11,28,48,0.04)]">
    <div className="flex justify-between items-center w-full px-4 sm:px-6 py-3 sm:py-3.5 max-w-7xl mx-auto min-h-14">
      <StoreBrandLink to="/" />
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name="lock" className="text-secondary text-xl" />
        <span className="text-[10px] sm:text-xs font-label font-bold tracking-[0.18em] uppercase text-on-surface-variant">
          Secure checkout
        </span>
      </div>
    </div>
  </header>
);

export const CheckoutStepBar = ({ current }: { current: 1 | 2 | 3 | 4 }) => (
  <nav className="mb-8 md:mb-12 overflow-x-auto no-scrollbar -mx-1 px-1">
    <ul className="flex items-center gap-3 sm:gap-6 md:gap-10 min-w-max pb-1">
      {[
        { step: 1, label: "Cart" },
        { step: 2, label: "Shipping" },
        { step: 3, label: "Payment" },
        { step: 4, label: "Review" },
      ].map(({ step, label }) => (
        <li key={step} className={`flex items-center gap-3 ${step > current ? "opacity-40" : ""}`}>
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              step === current ? "bg-secondary text-on-secondary" : "bg-surface-container-high text-on-surface"
            }`}
          >
            {step}
          </span>
          <span
            className={`font-label text-xs uppercase tracking-widest ${
              step === current ? "font-bold text-secondary" : "text-on-surface-variant"
            }`}
          >
            {label}
          </span>
        </li>
      ))}
    </ul>
  </nav>
);

export const CheckoutFooter = () => (
  <footer className="bg-surface-dim mt-24 py-12 px-6">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
      <p className="text-on-surface-variant text-sm">© 2024 {STORE_NAME_FULL}. Consciously crafted.</p>
      <div className="flex gap-8">
        <Link className="text-xs font-bold uppercase tracking-widest text-on-surface hover:text-secondary transition-colors" to="/pages/privacy-policy">Privacy</Link>
        <Link className="text-xs font-bold uppercase tracking-widest text-on-surface hover:text-secondary transition-colors" to="/pages/terms">Terms</Link>
        <Link className="text-xs font-bold uppercase tracking-widest text-on-surface hover:text-secondary transition-colors" to="/support">Support</Link>
      </div>
    </div>
  </footer>
);

/* ─────────────────────────────────────────────
   ACCOUNT SIDEBAR — matches account_dashboard
───────────────────────────────────────────── */
const accountLinks = [
  { to: "/account", label: "Dashboard", icon: "dashboard", exact: true },
  { to: "/account/profile", label: "Profile", icon: "person_edit" },
  { to: "/account/addresses", label: "Addresses", icon: "home_pin" },
  { to: "/account/orders", label: "Orders", icon: "package_2" },
  { to: "/account/returns", label: "Returns", icon: "assignment_return" },
  { to: "/account/refunds", label: "Refunds", icon: "payments" },
  { to: "/account/reviews", label: "Reviews", icon: "rate_review" },
  { to: "/account/security", label: "Security", icon: "shield" },
  { to: "/account/preferences", label: "Preferences", icon: "tune" },
];

export const AccountMobileNav = () => (
  <div className="md:hidden sticky z-30 mb-6 mx-3 sm:mx-4 border-b border-outline-variant/25 bg-surface/92 backdrop-blur-md shadow-sm top-[calc(4rem+env(safe-area-inset-top,0px))]">
    <div className="flex overflow-x-auto no-scrollbar gap-1.5 px-2 py-2.5 snap-x snap-mandatory">
      {accountLinks.map(({ to, label, icon, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className={({ isActive }) =>
            `flex-shrink-0 snap-start flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-label font-bold tracking-wide whitespace-nowrap transition-colors border ${
              isActive
                ? "bg-secondary/12 text-secondary border-secondary/25"
                : "bg-surface-container-low text-on-surface-variant border-outline-variant/15 hover:border-outline-variant/30 hover:text-on-surface"
            }`
          }
        >
          <Icon name={icon} className="text-base opacity-90" />
          {label}
        </NavLink>
      ))}
    </div>
  </div>
);

export const AccountSidebar = () => {
  const signOut = useCustomerStore((s) => s.signOut);

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-outline-variant/20 bg-surface-container-low/80 p-6 space-y-8 sticky top-[calc(4rem+env(safe-area-inset-top,0px))] self-start max-h-[calc(100dvh-5rem-env(safe-area-inset-top,0px))] overflow-y-auto">
      <div className="space-y-1">
        <div className="text-lg font-headline font-extrabold text-on-background tracking-tight">Welcome back, Julian</div>
        <div className="text-xs text-on-surface-variant font-label">Premium member since 2023</div>
      </div>
      <nav className="flex-grow space-y-1">
        {accountLinks.map(({ to, label, icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 font-headline font-semibold text-sm rounded-xl transition-all border border-transparent ${
                isActive
                  ? "text-secondary bg-secondary/10 border-secondary/15"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`
            }
          >
            <Icon name={icon} className="text-lg opacity-90" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="pt-6 border-t border-outline-variant/20 space-y-1">
        <NavLink
          to="/support"
          className="flex items-center gap-3 px-3 py-2.5 text-on-surface-variant font-headline font-medium text-sm hover:bg-surface-container rounded-xl transition-all"
        >
          <Icon name="support_agent" />
          <span>Support</span>
        </NavLink>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 text-on-surface-variant font-headline font-medium text-sm hover:bg-surface-container rounded-xl transition-all w-full text-left"
        >
          <Icon name="logout" />
          <span>Sign out</span>
        </button>
        <Link
          to="/support/new"
          className="block w-full mt-4 py-3 bg-secondary text-on-secondary rounded-xl font-headline text-sm font-bold tracking-tight text-center hover:opacity-95 transition-opacity"
        >
          Contact concierge
        </Link>
      </div>
    </aside>
  );
};

/* ─────────────────────────────────────────────
   ACCOUNT LAYOUT
───────────────────────────────────────────── */
export const AccountLayout = ({ children }: React.PropsWithChildren) => (
  <div className="min-h-dvh flex flex-col bg-surface text-on-background font-body">
    <TopNavBar />
    <div className="flex flex-1 w-full min-w-0 pt-[calc(4rem+env(safe-area-inset-top,0px))] md:pt-20">
      <AccountSidebar />
      <main className="flex-1 px-4 sm:px-6 md:px-10 lg:px-12 py-6 md:py-10 bg-surface pb-mobile-nav w-full min-w-0">
        <AccountMobileNav />
        <div className="min-w-0 overflow-x-hidden">{children}</div>
      </main>
    </div>
    <Footer />
    <BottomNavBar />
  </div>
);
