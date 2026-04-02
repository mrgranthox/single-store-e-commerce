import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScrollToTop } from "@/app/ScrollToTop";

// Storefront
import {
  HomePage,
  ShopAllPage,
  CategoryPage,
  ProductDetailPage,
  SearchPage,
  CampaignPage,
  WishlistPage,
  BrandsIndexPage,
  BrandPage,
} from "@/pages/storefront";
import {
  SubcategoryPage,
  ProductGalleryPage,
  ProductReviewsPage,
  ProductQuestionsPage,
  SavedItemsPage,
} from "@/pages/storefront-more";

// Checkout
import {
  CartPage,
  CheckoutShippingPage,
  CheckoutPaymentPage,
  CheckoutReviewPage,
  OrderSuccessPage,
  GuestTrackingPage,
} from "@/pages/checkout";

// Auth
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
  SessionExpiredPage,
} from "@/pages/auth";

// Account
import {
  AccountDashboardPage,
  ProfilePage,
  AddressesPage,
  OrdersListPage,
  OrderDetailPage,
  ShipmentTrackingPage,
  ReturnsListPage,
  ReturnRequestPage,
  RefundsListPage,
  ReviewsCenterPage,
  SecurityPage,
  PreferencesPage,
  AccountSupportPage,
  AccountTicketDetailPage,
} from "@/pages/account";

// Support
import {
  SupportCenterPage,
  HelpFaqPage,
  CreateTicketPage,
  TicketsListPage,
  TicketDetailPage,
  IssueReportingPage,
} from "@/pages/support";

// Content
import {
  ContactPage,
  AboutPage,
  ShippingPolicyPage,
  ReturnsPolicyPage,
  PrivacyPolicyPage,
  TermsPage,
} from "@/pages/content";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

const NotFoundPage = () => (
  <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-center px-6">
    <span className="material-symbols-outlined text-6xl text-outline mb-6">sentiment_dissatisfied</span>
    <h1 className="font-headline text-5xl font-extrabold tracking-tighter mb-4">404</h1>
    <p className="text-on-surface-variant mb-8 text-lg">This page doesn't exist in our catalogue.</p>
    <a href="/" className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90 transition-opacity">
      Return Home
    </a>
  </div>
);

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Storefront */}
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopAllPage />} />
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

        {/* Account */}
        <Route path="/account" element={<AccountDashboardPage />} />
        <Route path="/account/profile" element={<ProfilePage />} />
        <Route path="/account/addresses" element={<AddressesPage />} />
        <Route path="/account/orders" element={<OrdersListPage />} />
        <Route path="/account/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="/account/orders/:orderId/tracking" element={<ShipmentTrackingPage />} />
        <Route path="/account/orders/:orderId/track" element={<ShipmentTrackingPage />} />
        <Route path="/account/orders/:orderId/return" element={<ReturnRequestPage />} />
        <Route path="/account/returns" element={<ReturnsListPage />} />
        <Route path="/account/returns/new" element={<ReturnRequestPage />} />
        <Route path="/account/refunds" element={<RefundsListPage />} />
        <Route path="/account/reviews" element={<ReviewsCenterPage />} />
        <Route path="/account/security" element={<SecurityPage />} />
        <Route path="/account/preferences" element={<PreferencesPage />} />
        <Route path="/account/support" element={<AccountSupportPage />} />
        <Route path="/account/support/new" element={<CreateTicketPage />} />
        <Route path="/account/support/:ticketId" element={<AccountTicketDetailPage />} />

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
    </BrowserRouter>
  </QueryClientProvider>
);
