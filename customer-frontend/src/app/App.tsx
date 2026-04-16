import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScrollToTop } from "@/app/ScrollToTop";
import { PageLoader } from "@/app/PageLoader";
import { RequireCustomerAuth } from "@/app/require-customer-auth";
import { useCustomerStore } from "@/lib/store/customer-store";

// ---------------------------------------------------------------------------
// Lazy route components — each barrel becomes a separate Vite chunk.
// Granularity: per page (not per barrel) via the .then(m => default) pattern.
// ---------------------------------------------------------------------------

// Storefront
const HomePage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.HomePage })));
const ShopAllPage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.ShopAllPage })));
const CategoriesIndexPage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.CategoriesIndexPage })));
const CategoryPage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.CategoryPage })));
const ProductDetailPage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.ProductDetailPage })));
const SearchPage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.SearchPage })));
const CampaignPage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.CampaignPage })));
const WishlistPage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.WishlistPage })));
const BrandsIndexPage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.BrandsIndexPage })));
const BrandPage = lazy(() => import("@/pages/storefront").then((m) => ({ default: m.BrandPage })));

// Storefront extended
const SubcategoryPage = lazy(() => import("@/pages/storefront-more").then((m) => ({ default: m.SubcategoryPage })));
const ProductGalleryPage = lazy(() => import("@/pages/storefront-more").then((m) => ({ default: m.ProductGalleryPage })));
const ProductReviewsPage = lazy(() => import("@/pages/storefront-more").then((m) => ({ default: m.ProductReviewsPage })));
const ProductQuestionsPage = lazy(() => import("@/pages/storefront-more").then((m) => ({ default: m.ProductQuestionsPage })));
const SavedItemsPage = lazy(() => import("@/pages/storefront-more").then((m) => ({ default: m.SavedItemsPage })));

// Checkout — eagerly preloaded once the cart is mounted (see CartPage)
const CartPage = lazy(() => import("@/pages/checkout").then((m) => ({ default: m.CartPage })));
const CheckoutShippingPage = lazy(() => import("@/pages/checkout").then((m) => ({ default: m.CheckoutShippingPage })));
const CheckoutPaymentPage = lazy(() => import("@/pages/checkout").then((m) => ({ default: m.CheckoutPaymentPage })));
const CheckoutReviewPage = lazy(() => import("@/pages/checkout").then((m) => ({ default: m.CheckoutReviewPage })));
const OrderSuccessPage = lazy(() => import("@/pages/checkout").then((m) => ({ default: m.OrderSuccessPage })));
const GuestTrackingPage = lazy(() => import("@/pages/checkout").then((m) => ({ default: m.GuestTrackingPage })));

// Auth
const LoginPage = lazy(() => import("@/pages/auth").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/auth").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("@/pages/auth").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/pages/auth").then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import("@/pages/auth").then((m) => ({ default: m.VerifyEmailPage })));
const SessionExpiredPage = lazy(() => import("@/pages/auth").then((m) => ({ default: m.SessionExpiredPage })));

// Account
const AccountDashboardPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.AccountDashboardPage })));
const ProfilePage = lazy(() => import("@/pages/account").then((m) => ({ default: m.ProfilePage })));
const AddressesPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.AddressesPage })));
const AccountOrdersListPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.OrdersListPage })));
const AccountOrderDetailPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.OrderDetailPage })));
const ShipmentTrackingPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.ShipmentTrackingPage })));
const ReturnRequestPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.ReturnRequestPage })));
const ReturnsListPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.ReturnsListPage })));
const RefundsListPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.RefundsListPage })));
const ReviewsCenterPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.ReviewsCenterPage })));
const AccountSecurityPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.SecurityPage })));
const PreferencesPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.PreferencesPage })));
const AccountSupportPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.AccountSupportPage })));
const AccountTicketDetailPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.AccountTicketDetailPage })));

// Support
const SupportCenterPage = lazy(() => import("@/pages/support").then((m) => ({ default: m.SupportCenterPage })));
const HelpFaqPage = lazy(() => import("@/pages/support").then((m) => ({ default: m.HelpFaqPage })));
const CreateTicketPage = lazy(() => import("@/pages/support").then((m) => ({ default: m.CreateTicketPage })));
const TicketsListPage = lazy(() => import("@/pages/support").then((m) => ({ default: m.TicketsListPage })));
const TicketDetailPage = lazy(() => import("@/pages/support").then((m) => ({ default: m.TicketDetailPage })));
const IssueReportingPage = lazy(() => import("@/pages/support").then((m) => ({ default: m.IssueReportingPage })));

// Content (static pages — lazily loaded to keep initial bundle tight)
const ContactPage = lazy(() => import("@/pages/content").then((m) => ({ default: m.ContactPage })));
const AboutPage = lazy(() => import("@/pages/content").then((m) => ({ default: m.AboutPage })));
const ShippingPolicyPage = lazy(() => import("@/pages/content").then((m) => ({ default: m.ShippingPolicyPage })));
const ReturnsPolicyPage = lazy(() => import("@/pages/content").then((m) => ({ default: m.ReturnsPolicyPage })));
const PrivacyPolicyPage = lazy(() => import("@/pages/content").then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import("@/pages/content").then((m) => ({ default: m.TermsPage })));

// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

const AuthHydration = () => {
  const hydrateAuth = useCustomerStore((s) => s.hydrateAuth);
  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);
  return null;
};

const NotFoundPage = () => (
  <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-center px-6">
    <span className="material-symbols-outlined text-6xl text-outline mb-6">sentiment_dissatisfied</span>
    <h1 className="font-headline text-5xl font-extrabold tracking-tighter mb-4">404</h1>
    <p className="text-on-surface-variant mb-8 text-lg">This page doesn&apos;t exist in our catalogue.</p>
    <a href="/" className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90 transition-opacity">
      Return Home
    </a>
  </div>
);

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthHydration />
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Storefront */}
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopAllPage />} />
          <Route path="/categories" element={<CategoriesIndexPage />} />
          <Route path="/categories/:categorySlug" element={<CategoryPage />} />
          <Route path="/categories/:categorySlug/:subcategorySlug" element={<SubcategoryPage />} />
          <Route path="/brands" element={<BrandsIndexPage />} />
          <Route path="/brands/:brandSlug" element={<BrandPage />} />
          <Route path="/products/:productSlug" element={<ProductDetailPage />} />
          <Route path="/products/:productSlug/media" element={<ProductGalleryPage />} />
          <Route path="/products/:productSlug/reviews" element={<ProductReviewsPage />} />
          <Route path="/products/:productSlug/questions" element={<ProductQuestionsPage />} />
          <Route path="/saved-items" element={<SavedItemsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/campaigns/:campaignSlug" element={<CampaignPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/saved" element={<WishlistPage />} />

          {/* Checkout */}
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<Navigate to="/cart" replace />} />
          <Route path="/checkout/shipping" element={<CheckoutShippingPage />} />
          <Route path="/checkout/payment" element={<CheckoutPaymentPage />} />
          <Route path="/checkout/review" element={<CheckoutReviewPage />} />
          <Route path="/checkout/success" element={<OrderSuccessPage />} />
          <Route path="/track-order" element={<GuestTrackingPage />} />
          <Route path="/track" element={<GuestTrackingPage />} />

          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/session-expired" element={<SessionExpiredPage />} />

          {/* Account — signed-in only; guests can still checkout and use /track-order */}
          <Route
            path="/account"
            element={
              <RequireCustomerAuth>
                <AccountDashboardPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/profile"
            element={
              <RequireCustomerAuth>
                <ProfilePage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/addresses"
            element={
              <RequireCustomerAuth>
                <AddressesPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/orders"
            element={
              <RequireCustomerAuth>
                <AccountOrdersListPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/orders/:orderId"
            element={
              <RequireCustomerAuth>
                <AccountOrderDetailPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/orders/:orderId/tracking"
            element={
              <RequireCustomerAuth>
                <ShipmentTrackingPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/orders/:orderId/track"
            element={
              <RequireCustomerAuth>
                <ShipmentTrackingPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/orders/:orderId/return"
            element={
              <RequireCustomerAuth>
                <ReturnRequestPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/returns"
            element={
              <RequireCustomerAuth>
                <ReturnsListPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/returns/new"
            element={
              <RequireCustomerAuth>
                <ReturnRequestPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/refunds"
            element={
              <RequireCustomerAuth>
                <RefundsListPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/reviews"
            element={
              <RequireCustomerAuth>
                <ReviewsCenterPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/security"
            element={
              <RequireCustomerAuth>
                <AccountSecurityPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/preferences"
            element={
              <RequireCustomerAuth>
                <PreferencesPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/support"
            element={
              <RequireCustomerAuth>
                <AccountSupportPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/support/new"
            element={
              <RequireCustomerAuth>
                <CreateTicketPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/account/support/:ticketId"
            element={
              <RequireCustomerAuth>
                <AccountTicketDetailPage />
              </RequireCustomerAuth>
            }
          />

          {/* Support */}
          <Route path="/support" element={<SupportCenterPage />} />
          <Route path="/help" element={<HelpFaqPage />} />
          <Route path="/support/new" element={<CreateTicketPage />} />
          <Route path="/support/tickets" element={<TicketsListPage />} />
          <Route path="/support/ticket/:ticketId" element={<TicketDetailPage />} />
          <Route path="/support/issues" element={<IssueReportingPage />} />
          <Route path="/support/issue" element={<Navigate to="/support/issues" replace />} />

          {/* Content */}
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/pages/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/pages/returns-policy" element={<ReturnsPolicyPage />} />
          <Route path="/pages/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/pages/terms" element={<TermsPage />} />

          {/* Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </QueryClientProvider>
);
