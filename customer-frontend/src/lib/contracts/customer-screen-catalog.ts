export type CustomerScreenGroup =
  | "storefront"
  | "checkout"
  | "auth"
  | "account"
  | "support"
  | "content";

export type CustomerShellVariant = "storefront" | "checkout" | "account" | "support" | "auth" | "content";

export type CustomerScreenId =
  | "home"
  | "shop"
  | "category"
  | "subcategory"
  | "brand"
  | "search"
  | "productDetail"
  | "productGallery"
  | "productReviews"
  | "productQuestions"
  | "campaign"
  | "wishlist"
  | "cart"
  | "checkoutShell"
  | "checkoutShipping"
  | "checkoutPayment"
  | "checkoutReview"
  | "checkoutSuccess"
  | "guestOrderTracking"
  | "savedItems"
  | "login"
  | "register"
  | "forgotPassword"
  | "resetPassword"
  | "verifyEmail"
  | "sessionExpired"
  | "accountDashboard"
  | "profile"
  | "addresses"
  | "ordersList"
  | "orderDetail"
  | "shipmentTrackingDetail"
  | "returnsList"
  | "returnRequestWizard"
  | "refundsList"
  | "reviewsCenter"
  | "securitySessions"
  | "preferences"
  | "supportCenter"
  | "createSupportTicket"
  | "supportTicketsList"
  | "supportTicketDetail"
  | "issueReporting"
  | "helpFaq"
  | "contact"
  | "about"
  | "shippingPolicy"
  | "returnsPolicy"
  | "privacyPolicy"
  | "termsConditions";

export type CustomerScreen = {
  id: CustomerScreenId;
  title: string;
  route: string;
  group: CustomerScreenGroup;
  shell: CustomerShellVariant;
  description: string;
  stitchRefs: string[];
};

const screen = (
  id: CustomerScreenId,
  title: string,
  route: string,
  group: CustomerScreenGroup,
  shell: CustomerShellVariant,
  description: string,
  stitchRefs: string[]
): CustomerScreen => ({ id, title, route, group, shell, description, stitchRefs });

export const customerScreenCatalog: CustomerScreen[] = [
  screen("home", "Home", "/", "storefront", "storefront", "Editorial storefront home and discovery hub.", ["home_page", "mobile_home_page"]),
  screen("shop", "Shop / All Products", "/shop", "storefront", "storefront", "Full catalog browsing with filtering and merchandising.", ["shop_all_products", "mobile_shop_all_products"]),
  screen("category", "Category", "/categories/:categorySlug", "storefront", "storefront", "Category landing with discovery-led layout.", ["category_page_desktop", "mobile_category_home"]),
  screen("subcategory", "Subcategory", "/categories/:categorySlug/:subcategorySlug", "storefront", "storefront", "Focused subcategory merchandising and product listing.", ["subcategory_page_desktop", "subcategory_knitwear", "mobile_subcategory_knitwear"]),
  screen("brand", "Brand", "/brands/:brandSlug", "storefront", "storefront", "Brand archive and storytelling-led product view.", ["brand_page_desktop", "brand_directory", "brand_atelier_archive", "mobile_brand_directory", "mobile_brand_atelier_archive"]),
  screen("search", "Search Results", "/search", "storefront", "storefront", "Search results with query insights and dynamic filters.", ["search_results", "mobile_search_results"]),
  screen("productDetail", "Product Detail", "/products/:productSlug", "storefront", "storefront", "Product evaluation and purchase entry point.", ["product_detail_page", "mobile_product_detail"]),
  screen("productGallery", "Product Media Gallery", "/products/:productSlug/media", "storefront", "storefront", "Fullscreen media exploration for product imagery.", ["product_gallery_fullscreen"]),
  screen("productReviews", "Product Reviews", "/products/:productSlug/reviews", "storefront", "storefront", "Long-form customer reviews and review filters.", ["product_reviews_desktop", "product_reviews_mobile"]),
  screen("productQuestions", "Product Questions", "/products/:productSlug/questions", "storefront", "storefront", "Pre-purchase inquiries and product question thread.", ["product_q_a_inquiry", "product_q_a_inquiry_desktop", "mobile_product_q_a"]),
  screen("campaign", "Campaign / Landing", "/campaigns/:campaignSlug", "storefront", "storefront", "Campaign-led merchandising and story page.", ["campaign_the_winter_edit", "campaign_the_winter_edit_desktop", "seasonal_gift_guide", "seasonal_gift_guide_desktop", "seasonal_gift_guide_mobile", "mobile_campaign_winter_edit", "mobile_seasonal_gift_guide_1", "mobile_seasonal_gift_guide_2"]),
  screen("wishlist", "Wishlist", "/wishlist", "storefront", "storefront", "Saved products and later-purchase staging area.", ["wishlist_desktop", "wishlist_mobile"]),
  screen("cart", "Cart", "/cart", "checkout", "checkout", "Cart review, couponing, and checkout gateway.", ["cart_review", "mobile_cart"]),
  screen("checkoutShell", "Checkout Shell", "/checkout", "checkout", "checkout", "Shared checkout shell with progress and trust elements.", ["checkout_shipping", "checkout_payment", "checkout_review_order"]),
  screen("checkoutShipping", "Checkout Shipping", "/checkout/shipping", "checkout", "checkout", "Shipping contact, address, and method step.", ["checkout_shipping", "mobile_checkout_shipping"]),
  screen("checkoutPayment", "Checkout Payment", "/checkout/payment", "checkout", "checkout", "Payment method collection and billing confirmation.", ["checkout_payment", "mobile_checkout_payment"]),
  screen("checkoutReview", "Checkout Review", "/checkout/review", "checkout", "checkout", "Order review with final eligibility and pricing state.", ["checkout_review_order", "mobile_checkout_review_order"]),
  screen("checkoutSuccess", "Checkout Success", "/checkout/success", "checkout", "checkout", "Confirmation, next steps, and post-purchase actions.", ["order_success", "mobile_order_success"]),
  screen("guestOrderTracking", "Guest Order Tracking", "/track-order", "checkout", "checkout", "Guest order lookup and shipment state.", ["shipment_tracking_detail", "mobile_shipment_tracking_detail"]),
  screen("savedItems", "Saved Items / Recently Viewed", "/saved-items", "checkout", "storefront", "Wishlist-adjacent saved items and recently viewed list.", ["saved_recently_viewed", "saved_recently_viewed_desktop"]),
  screen("login", "Login", "/login", "auth", "auth", "Customer sign-in entry point.", ["login", "mobile_login"]),
  screen("register", "Register", "/register", "auth", "auth", "Customer account registration flow.", ["register", "mobile_register"]),
  screen("forgotPassword", "Forgot Password", "/forgot-password", "auth", "auth", "Password reset request flow.", ["forgot_password"]),
  screen("resetPassword", "Reset Password", "/reset-password", "auth", "auth", "Password reset completion form.", ["reset_password"]),
  screen("verifyEmail", "Verify Email", "/verify-email", "auth", "auth", "Email verification and resend state.", ["verification_email", "verification_email_desktop", "mobile_verification_success"]),
  screen("sessionExpired", "Session Expired", "/session-expired", "auth", "auth", "Session recovery and re-authentication page.", ["session_expired", "session_expired_desktop", "mobile_session_expired"]),
  screen("accountDashboard", "Account Dashboard", "/account", "account", "account", "Customer hub for orders, support, and actions.", ["account_dashboard", "mobile_dashboard"]),
  screen("profile", "Profile", "/account/profile", "account", "account", "Customer profile and account identity settings.", ["account_profile", "account_profile_desktop", "mobile_account_profile"]),
  screen("addresses", "Addresses", "/account/addresses", "account", "account", "Saved address management page.", ["saved_addresses", "account_saved_addresses", "mobile_account_saved_addresses"]),
  screen("ordersList", "Orders List", "/account/orders", "account", "account", "Customer order history and order list.", ["order_history", "mobile_order_history"]),
  screen("orderDetail", "Order Detail", "/account/orders/:orderId", "account", "account", "Single order truth page with eligibility-driven actions.", ["mobile_order_detail", "order_history"]),
  screen("shipmentTrackingDetail", "Shipment Tracking Detail", "/account/orders/:orderId/tracking", "account", "account", "Detailed shipment milestones and delivery progress.", ["shipment_tracking_detail", "mobile_shipment_tracking_detail"]),
  screen("returnsList", "Returns List", "/account/returns", "account", "account", "Returns overview and status tracking.", ["account_returns_list", "mobile_account_returns_list"]),
  screen("returnRequestWizard", "Return Request Wizard", "/account/orders/:orderId/return", "account", "account", "Guided return intake and eligibility capture.", ["return_request_wizard", "return_request_wizard_desktop", "mobile_return_request_wizard"]),
  screen("refundsList", "Refunds List", "/account/refunds", "account", "account", "Refund lifecycle view and payout status.", ["account_refunds_list", "account_refunds_list_desktop", "mobile_account_refunds_history", "refunds_list_desktop"]),
  screen("reviewsCenter", "Reviews Center", "/account/reviews", "account", "account", "Post-purchase review management center.", ["reviews_center", "reviews_center_desktop", "mobile_reviews_center"]),
  screen("securitySessions", "Security & Sessions", "/account/security", "account", "account", "Password, sessions, and account security view.", ["account_security_sessions", "mobile_account_security_sessions"]),
  screen("preferences", "Preferences", "/account/preferences", "account", "account", "Communication and preference management.", ["account_preferences", "account_preferences_desktop", "mobile_account_preferences"]),
  screen("supportCenter", "Support Center", "/support", "support", "support", "Self-serve support hub and escalation entry.", ["support_center", "support_center_desktop", "mobile_support_hub"]),
  screen("createSupportTicket", "Create Support Ticket", "/support/new", "support", "support", "Structured support ticket creation form.", ["create_support_ticket", "create_support_ticket_desktop"]),
  screen("supportTicketsList", "Support Tickets List", "/account/support", "support", "support", "Customer support ticket inbox.", ["support_tickets_list", "support_tickets_list_desktop", "support_tickets_mobile"]),
  screen("supportTicketDetail", "Support Ticket Detail", "/account/support/:ticketId", "support", "support", "Message thread and ticket state detail.", ["support_ticket_detail", "support_ticket_detail_desktop", "mobile_support_ticket_detail"]),
  screen("issueReporting", "Issue Reporting", "/support/issues", "support", "support", "Complaints and issue reporting page.", ["issue_reporting", "issue_reporting_desktop"]),
  screen("helpFaq", "Help / FAQ", "/help", "support", "support", "FAQ center and service knowledge base.", ["faq_help_center", "mobile_faq_help_center"]),
  screen("contact", "Contact", "/contact", "content", "content", "Public contact and concierge entry page.", ["contact_us", "contact_us_desktop", "mobile_contact_us"]),
  screen("about", "About", "/about", "content", "content", "Brand story and trust-building about page.", ["about_atelier", "mobile_about_atelier"]),
  screen("shippingPolicy", "Shipping Policy", "/pages/shipping-policy", "content", "content", "Shipping policy and delivery expectations.", ["shipping_returns_policy", "mobile_shipping_returns_policy"]),
  screen("returnsPolicy", "Returns Policy", "/pages/returns-policy", "content", "content", "Returns policy and eligibility explanation.", ["shipping_returns_policy", "mobile_shipping_returns_policy"]),
  screen("privacyPolicy", "Privacy Policy", "/pages/privacy-policy", "content", "content", "Privacy promise and data handling page.", ["privacy_policy", "privacy_policy_desktop", "mobile_privacy_policy"]),
  screen("termsConditions", "Terms & Conditions", "/pages/terms", "content", "content", "Terms, customer responsibilities, and legal framework.", ["terms_conditions", "terms_conditions_desktop", "mobile_terms_conditions"])
];

export const customerScreenCatalogById = Object.fromEntries(
  customerScreenCatalog.map((screenEntry) => [screenEntry.id, screenEntry])
) as Record<CustomerScreenId, CustomerScreen>;

export const getCustomerScreen = (screenId: CustomerScreenId) => customerScreenCatalogById[screenId];
