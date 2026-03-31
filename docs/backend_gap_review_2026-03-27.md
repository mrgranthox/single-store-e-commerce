# Backend Gap Review

Date: 2026-03-27

## Scope reviewed
- `docs/ecommerce_backend_api_implementation_contract_pack.md`
- `docs/ecommerce_customer_api_contract_50screens.md`
- `docs/ecommerce_mobile_api_contract_48screens.md`
- `docs/ecommerce_admin_api_contract_72screens.md`

## Completed in this pass
- Added public storefront compatibility routes for:
  - `/api/products`
  - `/api/products/:slug`
  - `/api/products/:slug/reviews`
  - `/api/products/:slug/questions`
  - `/api/categories`
  - `/api/categories/:slug/products`
  - `/api/brands/:slug/products`
  - `/api/search`
  - `/api/banners`
  - `/api/pages/:slug`
  - `/api/help`
  - `/api/contact`
  - `/api/catalog/campaigns/:slug`
- Added public ticket entrypoints for:
  - `/api/support/contact`
  - `/api/products/:slug/inquiry`
- Added mobile compatibility routes for:
  - `/api/mobile/home`
  - `/api/mobile/pages/:slug`
  - `/api/mobile/campaigns/:slug`
  - `/api/mobile/help`
  - `/api/mobile/contact`
  - `/api/mobile/products`
  - `/api/mobile/products/:slug`
  - `/api/mobile/products/:slug/reviews`
  - `/api/mobile/products/:slug/questions`
  - `/api/mobile/categories`
  - `/api/mobile/categories/:slug`
  - `/api/mobile/brands/:slug`
  - `/api/mobile/search`
  - `/api/mobile/cart`
  - `/api/mobile/cart/items`
  - `/api/mobile/cart/coupon`
  - `/api/mobile/cart/validate`
  - `/api/mobile/checkout`
  - `/api/mobile/checkout/shipping`
  - `/api/mobile/checkout/payment`
  - `/api/mobile/checkout/review`
  - `/api/mobile/checkout/orders`
  - `/api/mobile/checkout/success/:orderNumber`
- Added missing compatibility aliases for:
  - `POST /api/cart/coupon`
  - `POST /api/track-order`
- Extended public catalog filtering service support to accept `categoryId` and `brandId`.

## Runtime verification completed
- Typecheck: `npx tsc -p tsconfig.json --noEmit --pretty false`
- Build: `npm run build -- --pretty false`
- Live smoke:
  - `GET /health`
  - `GET /api/products?page=1&limit=2`
  - `GET /api/mobile/home`
  - `GET /api/mobile/checkout`
  - `GET /api/products/runtime-sneaker/questions`
  - `GET /api/catalog/campaigns/runtime-campaign`
  - `GET /api/mobile/checkout/success/:orderNumber`

## Remaining missing modules or features

### 1. Public customer auth is still incomplete
- Missing:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/forgot-password`
  - `POST /api/v1/auth/reset-password`
  - `POST /api/v1/auth/verify-email`
  - `POST /api/v1/auth/resend-verification`
- Current backend only exposes:
  - `GET /api/v1/auth/session`
  - `POST /api/v1/auth/logout`
  - Clerk webhook sync
- This is the largest remaining customer-scope contract gap.

### 2. Mobile auth is still incomplete
- Missing:
  - `POST /api/mobile/auth/register`
  - `POST /api/mobile/auth/login`
  - `POST /api/mobile/auth/refresh`
  - `POST /api/mobile/auth/forgot-password`
  - `POST /api/mobile/auth/reset-password`
  - `POST /api/mobile/auth/verify-email`
  - `POST /api/mobile/auth/resend-verification`
- Current mobile auth compatibility only covers session restore and logout.

### 3. Admin auth contract is still incomplete
- Missing:
  - `POST /api/admin/auth/login`
  - `POST /api/admin/auth/forgot-password`
  - `POST /api/admin/auth/reset-password`
- Current admin auth only covers session-aware shell context and session revocation.

### 4. Admin route compatibility layer is still incomplete
- The admin contract in `docs/ecommerce_admin_api_contract_72screens.md` expects plain routes such as:
  - `/api/admin/products`
  - `/api/admin/categories`
  - `/api/admin/brands`
  - `/api/admin/banners`
- Current implementation keeps the main admin catalog/content surface under:
  - `/api/admin/catalog/*`
  - `/api/admin/content/*`
- This is a route-contract gap, not a total feature absence.

## Partial implementations and shape gaps

### 5. Mobile checkout is present but not yet exact to the documented DTOs
- Implemented:
  - bootstrap, shipping/review validation, order create alias, payment alias, success summary
- Still partial:
  - route bodies still reuse the backend checkout/payment DTOs rather than the exact mobile contract DTOs
  - `POST /api/mobile/checkout/payment` currently behaves as order-backed payment initialization, not a separate pre-order payment-step contract
  - `POST /api/mobile/checkout/orders` does not yet return the exact `{ order, payment }` response shape from the mobile doc

### 6. Storefront catalog filtering is only partially aligned to the mobile contract
- Implemented:
  - query text
  - pagination
  - categoryId
  - brandId
  - path-based category and brand landing pages
  - sort mapping for common list sorts
- Still missing from the documented filter set:
  - `minPrice`
  - `maxPrice`
  - `rating`
  - `availability`
  - subcategory-specific listing support

### 7. Product questions/Q&A is only metadata today
- Implemented:
  - `/products/:slug/questions`
  - `/mobile/products/:slug/questions`
  - public inquiry submission route
- Still missing:
  - persisted public question threads
  - customer-visible question list
  - moderation or admin workflow dedicated to product Q&A
- The current endpoint is a support-inquiry metadata surface, not a full Q&A module.

### 8. Public support/contact is functional but still lightweight
- Implemented:
  - guest/authenticated public contact ticket creation
  - guest/authenticated product inquiry ticket creation
- Still missing:
  - explicit anti-abuse controls at the route level
  - CAPTCHA or equivalent spam defense
  - public guest attachment workflow
  - first-class structured product linkage on the ticket model

### 9. Login-event security workflow is only partially wired
- The data model and admin security reporting for `login_events` exist.
- The missing auth/login endpoints mean the system still does not fully generate customer/admin login events from real backend-owned login flows.
- That leaves the security dashboard data model ahead of the actual auth event pipeline.

### 10. Admin catalog/content contract still has endpoint gaps
- Not yet aligned to the admin contract:
  - product pricing read/update endpoints
  - product inventory-summary endpoint
  - nested media reorder endpoint
  - nested media delete alias under product path
  - category archive endpoint
  - brand archive endpoint
  - banner publish/unpublish endpoints

### 11. Automated test coverage is still thin
- Current verification is compile plus targeted runtime smoke.
- The repo still lacks a durable automated test suite for:
  - auth workflows
  - cart and checkout invariants
  - payments webhook lifecycle
  - returns/refunds state transitions
  - admin RBAC contract coverage

## Current backend state
- The backend is no longer missing the major public/mobile storefront compatibility surface.
- The remaining largest gaps are now concentrated in:
  1. auth
  2. admin compatibility aliases and some admin catalog/content endpoints
  3. exact DTO alignment for mobile checkout
  4. deeper automated verification
