# E-Commerce Platform README

## Single-store now · Future multi-store ready · Full-system implementation guide

This README is the **master overview for the entire e-commerce platform**. It consolidates the current system scope, architecture direction, major modules, operational rules, and implementation boundaries into one implementation-oriented reference.

It is written to align with the current platform pack and the latest direction to use the **94-admin-screen scope** rather than the 72-core-screen planning subset.

---

# 1. System overview

This platform is a **full commerce system**, not just a storefront and checkout flow.

It includes:

- a **94-screen admin control center**
- a **50-screen customer web application**
- a **48-screen mobile application**
- a **modular monolith backend**
- **queue-backed asynchronous processing**
- **role-based admin control**
- **auditability, observability, and security workflows**
- **promotions and coupons**
- **post-purchase service flows**
- **future multi-store readiness**

The platform is intentionally designed to support:

- catalog and merchandising operations
- inventory and warehouse control
- order processing and fulfillment
- payment verification and refund workflows
- customer intelligence and support operations
- content, promotion, and coupon management
- reporting, security oversight, and system monitoring

---

# 2. Scope position

## 2.1 Official product surfaces

### Admin

Use the **94-screen admin scope** as the implementation target.

This means the admin includes:

- the original core operational screens (expanded within the full 94-screen admin scope)
- the extended analytics, governance, and monitoring split views through screen 94

### Customer web

The customer-facing web app remains a **50-screen experience** covering:

- discovery
- evaluation
- checkout
- account management
- support
- returns/refunds
- trust content

### Mobile

The mobile app remains in the **48-screen range** implied by the backend implementation pack and overall platform scope.

## 2.2 Features explicitly included

Included in current scope:

- coupons
- promotions
- campaigns
- CMS pages
- banners
- reviews
- returns
- refunds
- support tickets
- alerts
- incidents
- system monitoring

## 2.3 Features explicitly excluded for now but must preserve space for

Not in current scope:

- loyalty points
- rewards engine
- wallet balance
- subscriptions
- marketplace / multi-vendor behavior
- full multi-store behavior
- advanced exchange management
- saved card vault / card-on-file engine
- distributed microservices architecture

## 2.4 Future-ready space to preserve

The system should leave room for:

- multi-store expansion
- loyalty/rewards later
- advanced search later
- SMS/push notifications later
- more sophisticated fraud scoring later

---

# 3. High-level product architecture

The platform is composed of five primary layers:

1. **Admin applications**
2. **Customer applications**
3. **Backend API and business logic**
4. **Asynchronous worker/queue layer**
5. **Data and integration layer**

## 3.1 Architectural style

The backend should be implemented as a **modular monolith**.

Why this is the right fit now:

- easier transactional consistency
- simpler deployment
- less operational overhead
- better coordination across catalog, inventory, orders, and payments
- still compatible with future service extraction later

## 3.2 Core system principles

The system should be built around:

- backend-driven business rules
- route-level and action-level RBAC
- append-friendly audits and timelines
- strong idempotency for payment-safe operations
- queue-backed async processing
- observability from day one
- confirmation-backed sensitive actions
- single-store UX now, multi-store-ready internals later

---

# 4. Final platform stack

## 4.1 Backend

- **Node.js**
- **TypeScript**
- **Express.js**
- **Prisma ORM**
- **PostgreSQL**
- **Redis**
- **BullMQ**
- **Zod** for validation
- **structured logging**
- **Sentry** for error monitoring

## 4.2 Admin frontend

- **React**
- **TypeScript**
- **React Router**
- **TanStack React Query**
- **React Hook Form**
- **Zod**
- **Zustand** where needed
- **Tailwind CSS**
- **TanStack Table**
- **Recharts** or equivalent

## 4.3 Customer frontend

- **React**
- **TypeScript**
- **React Router**
- **TanStack React Query**
- **React Hook Form + Zod**
- **Tailwind CSS**
- **Zustand or lightweight UI state**
- merchandising carousel / slider support
- event instrumentation layer

## 4.4 Auth and security tooling

- **Clerk** for authentication and session identity
- backend-owned RBAC and permission enforcement
- backend-owned suspension / status / audit state

## 4.5 Queue and infra

- **Redis** for queue backing, cache, rate limit counters, and idempotency helpers
- **BullMQ** for queue orchestration
- **workers** for asynchronous processing
- **Cloudinary** for media and attachment storage and delivery

## 4.6 Payments and communications

- **Paystack** for cards and mobile money payments
- **Brevo** for transactional email delivery

## 4.7 Monitoring

- **Sentry**
- structured logs
- metrics
- health and readiness endpoints

---

# 5. Platform module map

The backend should be organized around these business domains:

- auth
- users
- roles-permissions
- catalog
- categories
- brands
- inventory
- carts
- checkout
- orders
- payments
- shipping
- promotions
- reviews
- support
- notifications
- content
- customers
- reports
- audit
- security
- alerts-incidents
- integrations
- system-settings
- jobs-workers
- health-observability

---

# 6. Admin application scope (94 screens)

The admin is the platform’s operational, financial, service, governance, and observability control center.

## 6.1 Admin screen inventory

### A. Access and shell (5)

1. Admin login
2. Forgot password
3. Reset password
4. Unauthorized / forbidden
5. Admin profile and session security

### B. Dashboard and oversight (6)

6. Executive dashboard overview
7. Sales performance dashboard
8. Operations control dashboard
9. Customer service dashboard
10. Risk and security dashboard
11. System health dashboard

### C. Catalog and merchandising (12)

12. Product list
13. Product create
14. Product edit
15. Product detail overview
16. Product analytics detail
17. Product variants management
18. Product media management
19. Product pricing and merchandising
20. Product inventory summary
21. Category management
22. Brand management
23. Reviews moderation

### D. Inventory and warehouses (8)

24. Inventory overview
25. Inventory low-stock queue
26. Inventory out-of-stock queue
27. Inventory movement history
28. Inventory adjustment console
29. Warehouse list
30. Warehouse detail
31. Warehouse inventory detail

### E. Orders and fulfillment (10)

32. Orders list
33. Order detail
34. Order timeline detail
35. Fulfillment queue
36. Packing and dispatch queue
37. Shipment detail
38. Shipment tracking events
39. Returns queue
40. Return detail
41. Cancellation requests queue

### F. Payments and financial control (7)

42. Payments list
43. Payment detail
44. Payment transaction timeline
45. Refunds queue
46. Refund detail
47. Failed payments investigation
48. Financial exceptions and reconciliation

### G. Customers and customer intelligence (8)

49. Customers list
50. Customer detail overview
51. Customer activity timeline
52. Customer orders history
53. Customer support history
54. Customer reviews history
55. Customer risk and security profile
56. Customer account action center

### H. Support and service operations (6)

57. Support tickets list
58. Support ticket detail
59. Support queue by SLA / priority
60. Pre-purchase inquiries queue
61. Returns and complaints support queue
62. Support analytics and SLA reporting

### I. Content, marketing, and growth (7)

63. Banners management
64. CMS pages management
65. Coupon management
66. Coupon redemption analytics
67. Promotions management
68. Promotion rules detail
69. Campaign performance overview

### J. Reporting and analytics (8)

70. Reports overview
71. Sales analytics report
72. Product performance analytics
73. Inventory analytics report
74. Customer analytics report
75. Support analytics report
76. Refunds and returns analytics
77. Marketing and coupon analytics

### K. Audit, alerts, security, and incidents (10)

78. Audit logs explorer
79. Admin action logs explorer
80. User activity explorer
81. Alerts center
82. Alert detail
83. Security events explorer
84. Security event detail
85. Incidents list
86. Incident detail and investigation workspace
87. Risk signals and fraud review

### L. System control and observability (7)

88. Settings overview
89. Checkout and commerce settings
90. Review and moderation settings
91. Support and SLA settings
92. Webhooks monitoring
93. Jobs and background processing monitor
94. API / integration health and exception monitor

## 6.2 Admin goals

The admin must enable staff to:

- manage commerce operations
- inspect and mutate business entities with traceability
- control support, refunds, and returns
- manage promotions and coupons
- inspect risks, alerts, security events, and incidents
- monitor background jobs, webhooks, and external integration health

## 6.3 Admin UX expectations

The admin should use:

- dashboard cards
- queue views
- filter bars
- searchable tables
- deep detail views
- timelines
- analytics panels
- side drawers
- confirmation and approval dialogs
- permission-based action hiding/disabling

---

# 7. Customer web application scope (50 screens)

The customer web app is a full commerce experience, not only a storefront.

## 7.1 Screen inventory

### A. Storefront and discovery (12)

1. Home
2. Shop / all products
3. Category page
4. Subcategory page
5. Brand page
6. Search results
7. Product detail
8. Product media / gallery view
9. Product reviews page
10. Product questions / pre-purchase inquiry
11. Campaign / landing page
12. Wishlist

### B. Cart and checkout (8)

13. Cart
14. Checkout shell
15. Checkout shipping step
16. Checkout payment step
17. Checkout review step
18. Checkout success
19. Guest order tracking
20. Saved cart / recently viewed

### C. Auth and identity (6)

21. Login
22. Register
23. Forgot password
24. Reset password
25. Verify email
26. Session expired / account recovery

### D. Account hub (12)

27. Account dashboard
28. Profile
29. Addresses
30. Orders list
31. Order detail
32. Shipment tracking detail
33. Returns list
34. Return request wizard
35. Refunds list
36. Reviews center
37. Security and sessions
38. Preferences and communication settings

### E. Support and service (6)

39. Support center
40. Create support ticket
41. Support tickets list
42. Support ticket detail
43. Complaints / issue reporting
44. Help / FAQ center

### F. Content and trust (6)

45. Contact page
46. About page
47. Shipping policy
48. Returns policy
49. Privacy policy
50. Terms and conditions

## 7.2 Customer goals

The customer app must support:

- product discovery
- confident evaluation
- friction-minimized checkout
- clear post-purchase service
- reviews and support
- returns and refunds
- trust-building content and policies

---

# 8. Mobile application scope

The system also targets a mobile application in the 48-screen range.

The mobile app should cover:

- discovery
- product detail
- cart and checkout support
- authentication
- account and orders
- tracking
- support
- returns/refunds
- essential content and trust flows

The mobile app should consume the same backend contracts wherever possible and preserve the same business rules as web.

---

# 9. Backend data and business model principles

## 9.1 Core business truth

The backend is the source of truth for:

- product availability
- checkout eligibility
- pricing normalization
- stock reservation and release
- order transitions
- payment verification
- return/refund eligibility
- review eligibility
- support eligibility
- admin authorization
- audit trails

## 9.2 Main entity families

The system will revolve around these data areas:

- users and admins
- roles and permissions
- products, variants, categories, brands
- warehouses, inventory items, inventory movements, reservations
- carts and checkout sessions
- orders and order items
- payments, payment transactions, payment attempts
- shipments and tracking events
- returns and refunds
- support tickets, messages, attachments
- banners, CMS pages, coupons, promotions, campaigns
- notifications
- audit logs, admin action logs, timelines
- security events, alerts, incidents
- webhook events, job runs, reconciliation runs
- runtime system settings

---

# 10. Auth, identity, and RBAC model

## 10.1 Authentication

Use **Clerk** for:

- login
- registration
- session issuance
- password reset
- email verification
- identity lifecycle

## 10.2 Authorization

The backend must remain the source of truth for:

- admin roles
- permission codes
- customer status
- admin status
- suspension / deactivation
- security flags
- high-risk action enforcement

## 10.3 Admin roles

The current admin role families are:

- super admin
- platform admin
- catalog manager
- inventory manager
- fulfillment manager
- finance admin
- support lead
- support agent
- content and marketing manager
- analyst / read-only admin

## 10.4 Permission design

Permission design must separate:

- read access
- operational write access
- approval authority
- override authority
- governance/security authority

## 10.5 Sensitive actions

Sensitive actions must always be backend-enforced and usually confirmation-backed, such as:

- publish/unpublish product
- archive product
- change pricing
- stock adjustment
- cancel order
- approve refund
- suspend/reactivate customer
- resolve alerts
- close incidents
- retry jobs/webhooks where allowed
- edit sensitive settings

---

# 11. Catalog, merchandising, promotions, and coupons

## 11.1 Catalog

The catalog domain includes:

- products
- variants
- media
- pricing
- category mapping
- brand mapping
- publish/archive state
- review moderation linkage
- analytics linkage

## 11.2 Promotions and coupons

Promotions and coupons are **required features** in current scope.

This includes:

- coupon creation and management
- coupon redemption analytics
- promotion management
- rule-level promotion targeting
- campaign performance views
- banners and campaign surfaces in storefront

## 11.3 Promotion and coupon rules

The backend must control:

- activation windows
- eligibility
- minimum order conditions
- product/category/brand targeting
- customer usage restrictions
- redemption limits
- abuse detection support
- interaction with checkout validation

## 11.4 Current boundaries

Required now:

- coupons
- promotions
- campaigns

Not required now:

- loyalty points
- referral rewards
- cashback
- wallet credit

---

# 12. Inventory model

## 12.1 Source of truth

Inventory should be tracked primarily at the **variant level**.

## 12.2 Main concepts

Each inventory item should model:

- on hand
- reserved
- available
- reorder level
- warehouse association

## 12.3 Core rules

- do not trust frontend stock assumptions
- reserve stock at checkout/order creation, not at add-to-cart
- release reservations when payment fails or expires
- deduct stock when payment/fulfillment policy requires it
- restock on return completion only when item condition allows

## 12.4 Inventory history

Every stock mutation must create an append-friendly inventory movement.

Examples:

- reservation
- reservation release
- deduction
- restock
- manual adjustment

---

# 13. Cart, checkout, and order creation

## 13.1 Cart

Cart supports:

- guest and authenticated user flows
- item add/update/remove
- coupon application
- totals preview
- checkout readiness warnings

## 13.2 Checkout

Checkout must be backend-revalidated and return:

- normalized totals
- shipping options
- coupon outcome
- warnings
- blocked items
- eligibility flags

## 13.3 Order creation

The system should create orders safely with:

- idempotency support
- pricing snapshot
- address snapshot
- item snapshot
- reservation support
- timeline generation

## 13.4 Guest checkout

Guest checkout may be enabled by settings and must still preserve enough identity/contact data for:

- order lookup
- support
- returns/refunds

---

# 14. Order, fulfillment, shipping, returns, and refunds

## 14.1 Order model

Order, payment, and fulfillment must remain **separate state dimensions**.

## 14.2 Fulfillment

Fulfillment scope includes:

- order queue
- picking/processing
- packing/dispatch
- shipment detail
- tracking events
- warehouse linkage
- cancellation queue
- returns intake

## 14.3 Returns

Returns flow should support:

- request
- review
- approve/reject
- mark received
- complete

## 14.4 Refunds

Refunds should support:

- queue views
- approval
- provider state tracking
- partial/full refund support
- finance exception visibility

---

# 15. Payment architecture

## 15.1 Payment principles

- frontend is never the final authority for payment success
- webhooks and provider verification decide final payment truth
- duplicate callbacks must be handled safely
- payment operations must be auditable
- financial mismatches must be visible to finance/admin workflows

## 15.2 Payment features

Current scope includes:

- payment initialization
- webhook verification
- transaction history
- refund synchronization
- failed payment investigations
- financial exceptions/reconciliation

## 15.3 Payment state handling

The internal model should support a robust state machine, including:

- initialization
- pending customer action
- paid
- failed
- cancelled
- refund pending
- partially refunded
- refunded

---

# 16. Support and customer service

## 16.1 Support scope

Support should cover:

- pre-purchase inquiries
- post-purchase issues
- ticket threads
- internal notes
- linked order and customer context
- SLA-driven queue prioritization
- complaint and damaged-item workflows

## 16.2 Admin support operations

Admin/support roles need:

- queue views
- ticket detail
- ticket assignment
- ticket replies
- internal notes
- status changes
- analytics

## 16.3 Customer support operations

Customers need:

- support center
- ticket creation
- ticket list
- ticket detail
- messaging/replies
- issue reporting

---

# 17. Content, trust, and CMS

The system includes a content layer for:

- homepage banners
- campaign surfaces
- CMS pages
- shipping policy
- returns policy
- privacy policy
- terms
- help / FAQ
- contact / about content

This allows the storefront and support experience to be trust-forward, not only transaction-focused.

---

# 18. Search, discovery, and discovery performance

## 18.1 Search direction

Start with database-backed search and indexed filtering.

## 18.2 Discovery filters

The customer app should support:

- category
- brand
- search
- price range
- rating
- availability
- variant attributes as needed

## 18.3 Admin filtering

Admin modules need rich filtering by:

- status
- date ranges
- actor
- assignee
- references
- entity types
- priority/severity

---

# 19. Notifications

Current scope should support queued notifications for:

- verification
- password reset
- order confirmation
- payment confirmation/failure
- shipment and delivery state changes
- return/refund state changes
- support ticket state changes
- admin operational alerts
- security alerts

Email is enough as the first delivery channel. The model should remain future-ready for push/SMS later.

---

# 20. Webhooks, queues, workers, and idempotency

## 20.1 Queue-backed architecture

The platform requires asynchronous processing. This is not optional.

## 20.2 Redis usage

Redis is required for:

- BullMQ queue backing
- short-lived caching
- rate limit counters
- idempotency helpers
- ephemeral system state

## 20.3 Workers

Workers are separate running processes that consume queued jobs such as:

- payment verification
- webhook processing
- notification delivery
- low-stock scans
- reconciliation tasks
- alert generation

## 20.4 Webhook architecture

Webhook handling should follow this pattern:

1. receive webhook
2. verify signature
3. persist event
4. respond quickly
5. enqueue processing
6. process in worker
7. record outcome and retries

## 20.5 Idempotency

Idempotency is required for:

- checkout creation
- payment initialization
- webhook processing
- refund-safe operations
- other destructive retry-safe flows

---

# 21. Auditability, security, and incident handling

## 21.1 Audit layers

The system should maintain:

- audit logs
- admin action logs
- timeline events

## 21.2 Security visibility

Admin/security surfaces must support:

- user activity review
- suspicious event review
- alert ownership and resolution
- incident management
- fraud/risk review

## 21.3 Operational philosophy

Security and governance are not bolt-ons. They are a built-in part of the admin system.

---

# 22. Observability and system monitoring

The system includes observability views and backend expectations for:

- health checks
- readiness checks
- webhook monitoring
- job/background processing monitoring
- API/integration health
- structured logging
- Sentry
- metrics where available

This is essential because the platform includes:

- payments
- queues
- background jobs
- admin actions
- customer service operations
- integration dependencies

---

# 23. Runtime settings and feature governance

The system should distinguish between:

- **environment secrets/config**
- **runtime business settings**

Runtime settings should include:

- checkout controls
- review/moderation settings
- support/SLA settings
- thresholds and policy controls

Feature-flag structure should leave room for:

- rewards/loyalty later
- deeper fraud tooling later
- advanced customer incentives later

But those features should remain disabled and unimplemented now.

---

# 24. API design principles

The backend should follow these principles:

- consistent response envelopes
- consistent pagination/filter/query patterns
- clear separation of list/detail/analytics/queue endpoints
- confirmation-backed sensitive mutations
- timeline/event data returned explicitly where the frontend needs it
- machine-readable error codes
- backend-driven eligibility flags

---

# 25. Backend-driven eligibility rules

The frontend must never invent critical business eligibility rules.

The backend should decide and return explicit flags for:

- checkout
- guest checkout
- review creation
- cancellation
- return eligibility
- refund eligibility
- support eligibility
- guest tracking availability

This keeps the customer apps and admin apps aligned with backend truth.

---

# 26. Shared UX and UI patterns

Across the admin and customer applications, shared primitives should include:

- page header
- filter bar
- status badge
- data tables
- summary cards
- timelines
- confirmation modals
- destructive dialogs
- loading skeletons
- empty/no-result states

Admin-specific shared patterns should also include:

- JSON inspectors for technical records
- approval dialogs with reason capture
- permission gate wrappers
- side drawers for quick inspection

---

# 27. Development and deployment posture

## 27.1 Development

Development should start locally with:

- local Postgres
- local Redis
- local API
- local worker
- Clerk in cloud
- Sentry in cloud

## 27.2 Production direction

Production should include:

- API hosting
- Postgres
- Redis
- worker hosting
- payment provider
- email provider
- storage provider
- observability stack

## 27.3 Environment model

Maintain:

- local
- staging
- production

---

# 28. Recommended implementation order

Build in this order:

1. foundation
   - Postgres
   - Prisma
   - Redis
   - BullMQ
   - worker baseline
   - Clerk integration
   - Sentry
   - health/readiness/error conventions

2. core commerce
   - catalog
   - inventory
   - cart
   - checkout
   - orders
   - payments

3. post-purchase and service
   - returns
   - refunds
   - customers
   - support
   - notifications

4. governance and operations
   - audit logs
   - admin action logs
   - alerts
   - incidents
   - system monitoring
   - settings

5. reporting and optimization
   - analytics
   - performance hardening
   - reconciliation
   - deeper observability

---

# 29. Current non-negotiables

The implementation must preserve these boundaries:

- **Use 94 admin screens**
- **No rewards or loyalty now**
- **Promotions and coupons are mandatory**
- **Single-store now**
- **Multi-store ready later**
- **Backend owns business truth**
- **Workers/queues are required**
- **RBAC is backend-enforced**
- **Sensitive actions require confirmation + auditability**
- **Webhooks must be durable and idempotent**

---

# 30. Final project position

This platform should be treated as:

- a **serious operations-heavy e-commerce system**
- a **queue-backed and audit-aware commerce backend**
- a **promotion-ready but non-loyalty system**
- a **94-screen admin governance and operations console**
- a **50-screen customer commerce experience**
- a **48-mobile-ready**
- a **future-expandable platform**

It is intentionally broader than a simple shop because the target is not just selling products; it is operating a controlled, support-aware, finance-aware, and observability-aware commerce system.

---

# 31. Quick reference summary

## Included now

- 94 admin screens
- 50 customer web screens
- 48 mobile screens
- products, categories, brands
- warehouses, inventory, adjustments
- cart, checkout, orders, payments
- returns, refunds, support
- banners, CMS, promotions, coupons
- reports, audit, alerts, incidents, risk views
- webhooks, jobs, integration monitoring
- Clerk auth + backend RBAC
- Sentry + logging + queue workers

## Excluded now

- loyalty
- rewards
- subscriptions
- marketplace
- wallet
- advanced exchange engine

## Keep room for later

- loyalty/rewards
- multi-store behavior
- external search
- richer fraud tooling
- extra notification channels

---

# 32. Implementation note

This README is the **whole-system reference**, not the line-by-line implementation spec.

Use it to:

- align engineering decisions
- orient new contributors
- avoid scope drift
- keep admin/customer/backend/mobile work coherent
- preserve the final 94-screen admin direction without re-opening scope every time
