# E-Commerce Mobile API Contract

## Executive overview
This document defines the mobile-facing API contract for the 48-screen customer mobile app. It is aligned to a single-store e-commerce platform with future multi-store readiness and is intended to support React Native / Expo implementation, backend development, QA, and AI-assisted coding.

The mobile API contract covers:
- authentication and session management
- catalog and search
- cart and checkout
- order tracking and post-purchase flows
- reviews, support, returns, refunds, and cancellations
- content and policy pages
- mobile-specific concerns such as pagination, offline-friendly responses, eligibility flags, and recoverable errors

The API design assumes:
- RESTful JSON APIs
- server-authoritative pricing and inventory validation
- JWT or secure token auth
- backend-driven eligibility and workflow state
- payment provider redirects or hosted payment flows where needed

---

## 1. Contract principles

### 1.1 Mobile-first contract rules
The mobile app should not infer critical business rules. The backend must explicitly return:
- eligibility flags
- status labels
- next allowed actions
- validation failures with actionable messages
- pagination metadata
- cacheable content where applicable

### 1.2 Response envelope
Recommended success envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "message": "optional"
}
```

Recommended error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ORDER_NOT_ELIGIBLE_FOR_RETURN",
    "message": "This order is outside the return window.",
    "details": {}
  }
}
```

### 1.3 Pagination standard
List endpoints should support:
- `page`
- `limit`
- optional `cursor` later for feeds or message threads

Recommended metadata:

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 123,
    "hasNextPage": true
  }
}
```

### 1.4 Timestamps and money
- timestamps: ISO 8601 UTC
- money: structured objects preferred for clarity

```json
{
  "amount": 49.99,
  "currency": "GHS"
}
```

---

## 2. Authentication and identity APIs

### 2.1 Register
`POST /api/mobile/auth/register`

Purpose:
Create a customer account.

Request:

```json
{
  "firstName": "Edward",
  "lastName": "Nyame",
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "marketingOptIn": false,
  "acceptTerms": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "status": "pending_verification"
    },
    "requiresEmailVerification": true
  }
}
```

### 2.2 Login
`POST /api/mobile/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt",
    "refreshToken": "refresh-token",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "Edward",
      "lastName": "Nyame"
    }
  }
}
```

### 2.3 Refresh token
`POST /api/mobile/auth/refresh`

### 2.4 Logout
`POST /api/mobile/auth/logout`

### 2.5 Forgot password
`POST /api/mobile/auth/forgot-password`

### 2.6 Reset password
`POST /api/mobile/auth/reset-password`

### 2.7 Verify email
`POST /api/mobile/auth/verify-email`

### 2.8 Resend verification
`POST /api/mobile/auth/resend-verification`

### 2.9 Session status
`GET /api/mobile/auth/session`

Purpose:
Restore app session on launch.

---

## 3. Home, content, and merchandising APIs

### 3.1 Home screen payload
`GET /api/mobile/home`

Purpose:
Return the full home screen composition.

Response shape:

```json
{
  "success": true,
  "data": {
    "heroBanners": [],
    "featuredCategories": [],
    "featuredProducts": [],
    "trendingProducts": [],
    "campaignBlocks": [],
    "trustHighlights": []
  }
}
```

### 3.2 CMS page by slug
`GET /api/mobile/pages/:slug`

Examples:
- shipping-policy
- returns-policy
- privacy-policy
- terms
- about

### 3.3 Campaign landing page
`GET /api/mobile/campaigns/:slug`

### 3.4 Help / FAQ content
`GET /api/mobile/help`

### 3.5 Contact page payload
`GET /api/mobile/contact`

---

## 4. Catalog and search APIs

### 4.1 Product listing
`GET /api/mobile/products`

Supported query params:
- `page`
- `limit`
- `categoryId`
- `brandId`
- `minPrice`
- `maxPrice`
- `rating`
- `availability`
- `sort`
- `query`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Product name",
        "slug": "product-name",
        "primaryImageUrl": "https://...",
        "price": { "amount": 49.99, "currency": "GHS" },
        "compareAtPrice": null,
        "ratingAverage": 4.6,
        "reviewCount": 18,
        "stockState": "in_stock",
        "badges": ["featured"]
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasNextPage": true
  }
}
```

### 4.2 Product detail
`GET /api/mobile/products/:slug`

Must include:
- product core data
- media
- variants
- rating summary
- review snippet preview
- shipping/returns highlights
- purchase eligibility
- support shortcut metadata
- related product summary

Important field pattern:

```json
{
  "eligibility": {
    "canPurchase": true,
    "reasonCode": null,
    "reasonMessage": null
  }
}
```

### 4.3 Product reviews list
`GET /api/mobile/products/:slug/reviews`

### 4.4 Product Q&A / inquiry metadata
`GET /api/mobile/products/:slug/questions`

### 4.5 Categories list
`GET /api/mobile/categories`

### 4.6 Category detail with products
`GET /api/mobile/categories/:slug`

### 4.7 Brand detail with products
`GET /api/mobile/brands/:slug`

### 4.8 Search
`GET /api/mobile/search`

Query params:
- `q`
- `page`
- `limit`
- filters

---

## 5. Wishlist APIs

### 5.1 Get wishlist
`GET /api/mobile/wishlist`

### 5.2 Add wishlist item
`POST /api/mobile/wishlist/items`

Request:

```json
{
  "productId": "uuid",
  "variantId": "uuid-or-null"
}
```

### 5.3 Remove wishlist item
`DELETE /api/mobile/wishlist/items/:wishlistItemId`

---

## 6. Cart APIs

### 6.1 Get cart
`GET /api/mobile/cart`

Must return:
- items
- summary totals
- applied coupon
- warnings
- checkout readiness

### 6.2 Add item to cart
`POST /api/mobile/cart/items`

### 6.3 Update cart item
`PATCH /api/mobile/cart/items/:cartItemId`

### 6.4 Remove cart item
`DELETE /api/mobile/cart/items/:cartItemId`

### 6.5 Apply coupon
`POST /api/mobile/cart/coupon`

### 6.6 Remove coupon
`DELETE /api/mobile/cart/coupon`

### 6.7 Cart validation
`POST /api/mobile/cart/validate`

Purpose:
Validate stock, pricing, and coupon state before checkout.

---

## 7. Checkout APIs

### 7.1 Checkout session bootstrap
`GET /api/mobile/checkout`

Returns:
- authenticated user summary
- saved addresses
- available shipping methods
- checkout configuration
- guest checkout allowed flag

### 7.2 Validate shipping step
`POST /api/mobile/checkout/shipping`

### 7.3 Validate payment step
`POST /api/mobile/checkout/payment`

### 7.4 Review checkout summary
`POST /api/mobile/checkout/review`

### 7.5 Create order
`POST /api/mobile/checkout/orders`

Request:

```json
{
  "contact": {
    "email": "user@example.com",
    "phone": "+233..."
  },
  "shippingAddress": {
    "fullName": "Edward Nyame",
    "country": "Ghana",
    "region": "Greater Accra",
    "city": "Accra",
    "addressLine1": "Address",
    "addressLine2": null
  },
  "billingAddress": null,
  "shippingMethodId": "uuid",
  "paymentMethod": "paystack"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "orderNumber": "ORD-1001",
      "status": "placed"
    },
    "payment": {
      "provider": "paystack",
      "reference": "ref_123",
      "checkoutUrl": "https://..."
    }
  }
}
```

### 7.6 Checkout success summary
`GET /api/mobile/checkout/success/:orderNumber`

---

## 8. Orders and tracking APIs

### 8.1 Account orders list
`GET /api/mobile/account/orders`

### 8.2 Order detail
`GET /api/mobile/account/orders/:orderId`

Must return:
- order header
- item list
- payment status
- fulfillment summary
- shipment summary
- address snapshots
- eligibility flags for cancellation, return, refund, and review

### 8.3 Shipment tracking detail
`GET /api/mobile/account/orders/:orderId/tracking`

### 8.4 Guest order tracking lookup
`POST /api/mobile/track-order`

Request:

```json
{
  "orderNumber": "ORD-1001",
  "email": "user@example.com"
}
```

---

## 9. Profile, addresses, security, and preferences APIs

### 9.1 Account dashboard payload
`GET /api/mobile/account`

### 9.2 Profile
- `GET /api/mobile/account/profile`
- `PATCH /api/mobile/account/profile`

### 9.3 Addresses
- `GET /api/mobile/account/addresses`
- `POST /api/mobile/account/addresses`
- `PATCH /api/mobile/account/addresses/:addressId`
- `DELETE /api/mobile/account/addresses/:addressId`

### 9.4 Preferences
- `GET /api/mobile/account/preferences`
- `PATCH /api/mobile/account/preferences`

### 9.5 Security
- `POST /api/mobile/account/security/change-password`
- `GET /api/mobile/account/security/sessions`
- `DELETE /api/mobile/account/security/sessions/:sessionId`

---

## 10. Reviews APIs

### 10.1 Reviews center payload
`GET /api/mobile/account/reviews`

Returns:
- pending review opportunities
- submitted reviews
- moderation states

### 10.2 Create review
`POST /api/mobile/account/reviews`

Request:

```json
{
  "orderItemId": "uuid",
  "productId": "uuid",
  "rating": 5,
  "title": "Great product",
  "comment": "Very satisfied"
}
```

### 10.3 Update review
`PATCH /api/mobile/account/reviews/:reviewId`

### 10.4 Product review eligibility
`GET /api/mobile/account/orders/:orderId/review-eligibility`

---

## 11. Support APIs

### 11.1 Support center payload
`GET /api/mobile/support`

### 11.2 Create support ticket
`POST /api/mobile/support/tickets`

Request:

```json
{
  "subject": "Delayed delivery",
  "category": "delivery_issue",
  "orderId": "uuid",
  "message": "My order has not arrived yet."
}
```

### 11.3 Tickets list
`GET /api/mobile/account/support`

### 11.4 Ticket detail
`GET /api/mobile/account/support/:ticketId`

### 11.5 Reply to ticket
`POST /api/mobile/account/support/:ticketId/messages`

### 11.6 Upload attachment
`POST /api/mobile/account/support/:ticketId/attachments`

### 11.7 Structured issue reporting options
`GET /api/mobile/support/issues`

---

## 12. Returns, refunds, and cancellation APIs

### 12.1 Returns list
`GET /api/mobile/account/returns`

### 12.2 Return eligibility
`GET /api/mobile/account/orders/:orderId/return-eligibility`

### 12.3 Create return request
`POST /api/mobile/account/orders/:orderId/returns`

Request:

```json
{
  "items": [
    {
      "orderItemId": "uuid",
      "quantity": 1,
      "reason": "damaged_item"
    }
  ],
  "description": "Package arrived damaged"
}
```

### 12.4 Refunds list
`GET /api/mobile/account/refunds`

### 12.5 Refund eligibility
`GET /api/mobile/account/orders/:orderId/refund-eligibility`

### 12.6 Cancellation eligibility
`GET /api/mobile/account/orders/:orderId/cancellation-eligibility`

### 12.7 Request cancellation
`POST /api/mobile/account/orders/:orderId/cancel`

---

## 13. Notifications and app utility APIs

### 13.1 Mobile notifications feed
`GET /api/mobile/notifications`

### 13.2 Mark notification read
`POST /api/mobile/notifications/:notificationId/read`

### 13.3 App bootstrap config
`GET /api/mobile/config`

Must return:
- app feature flags
- checkout settings relevant to mobile
- support settings relevant to mobile
- policy page slugs
- version or upgrade hints later

---

## 14. Mobile-specific response requirements

### 14.1 Every post-purchase detail endpoint should return eligibility
Example:

```json
{
  "actions": {
    "canCancel": false,
    "cancelReasonCode": "ORDER_ALREADY_SHIPPED",
    "canReturn": true,
    "returnReasonCode": null,
    "canRefundRequest": true,
    "canReview": false,
    "reviewReasonCode": "NOT_DELIVERED_YET"
  }
}
```

### 14.2 Offline-friendly content classes
The following endpoints are best suited for caching:
- home
- categories
- brands
- product detail summary
- CMS pages
- help content

The following endpoints should be treated as always-fresh:
- cart
- checkout
- order detail
- tracking
- return eligibility
- refund eligibility
- support ticket detail

### 14.3 Error code families
Recommended families:
- `AUTH_*`
- `CART_*`
- `CHECKOUT_*`
- `ORDER_*`
- `PAYMENT_*`
- `RETURN_*`
- `REFUND_*`
- `REVIEW_*`
- `SUPPORT_*`

Examples:
- `CHECKOUT_STOCK_CHANGED`
- `ORDER_NOT_FOUND`
- `RETURN_WINDOW_EXPIRED`
- `REVIEW_NOT_ELIGIBLE`
- `SUPPORT_TICKET_CLOSED`

---

## 15. Security and trust expectations
The API should support:
- secure token handling
- no client-side trust of price or stock
- backend verification of payment results
- explicit auth errors with recoverable next steps
- session expiry handling for mobile app recovery

---

## 16. Recommended implementation order
1. auth
2. home/catalog/search
3. cart
4. checkout
5. account/orders/tracking
6. reviews/support
7. returns/refunds/cancellation
8. content/help/config/notifications

---

## 17. Final position
This mobile API contract is designed to support the full 48-screen mobile app while keeping business rules server-authoritative and mobile flows predictable, resilient, and implementation-ready.
