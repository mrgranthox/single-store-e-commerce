# E-Commerce Relational Specification

## How to read this doc
This relational specification defines the *required* database relationships and constraints that make the platform implementation-grade.

It complements:
- `docs/database_architecture.md` (aggregate ownership and invariants)
- `docs/prisma_schema_v1.md` (implementation-grade Prisma schema)

Where this doc says “must”, the backend must implement the DB-invariant through:
- Prisma relations and unique constraints
- transactional writes
- idempotency/uniqueness rules for retry-safe operations

## Conventions
- All internal entity IDs are UUIDs.
- Business identifiers (order number, coupon code, tracking keys) are unique where needed.
- For “timeline/audit/history” tables: rows are append-only.
- Where multi-store is planned later: include optional `storeId` with forward-compatible indexing.

## Identity and authorization tables

### `users`
Purpose: customer identity and business state.
Must include:
- `id` UUID primary key
- `clerkUserId` unique
- `email` unique
- `status` enum (ACTIVE, PENDING_VERIFICATION, SUSPENDED, LOCKED, DEACTIVATED)

### `admin_users`
Purpose: admin identity and business state.
Must include:
- `id` UUID primary key
- `clerkAdminUserId` unique
- `email` unique
- `status` enum (ACTIVE, SUSPENDED, LOCKED, DEACTIVATED)

### `roles`, `permissions`, joins
- `roles`: role definitions (code, name)
- `permissions`: permission definitions (code, description, domain, action category)
- `role_permissions`: join table; must have unique `(roleId, permissionId)`
- `admin_user_roles`: join table; must have unique `(adminUserId, roleId)`

### Session and security evidence
- `session_metadata`: active session visibility; must support revocation at DB policy level.
  - includes `sessionId` unique
  - must support customer and admin sessions (via optional FKs)
- `login_events`: every login attempt writes a row (success/failure, IP/user agent).
- `security_events`: suspicious patterns and risk responses; append-only by event.
- `user_status_history`: append-only history of status changes.

Key relational constraints:
- `login_events.userId` may be nullable (for totally unknown users), but should store email when possible.
- `session_metadata` revocation must not rely on UI; backend must check revocation in DB.

## Catalog tables

### `products`
Must include:
- `id` UUID PK
- `slug` unique
- `title`
- `description` optional
- `status` enum (DRAFT, PUBLISHED, ARCHIVED)

### `product_variants`
Must include:
- `id` UUID PK
- `productId` FK -> products
- `sku` unique (or unique per product, depending on policy)
- `attributes` JSON (variant-level attribute set)
- `status` enum (ACTIVE, ARCHIVED)

### `product_media`
Must include:
- `id` UUID PK
- `productId` FK
- optional `variantId` FK
- `url` and `kind` enum (IMAGE, VIDEO, DOCUMENT optional)
- should be ordered (sortOrder) for stable gallery rendering

### `categories`, `brands`
- `slug` must be unique
- `products <-> categories` is typically many-to-many in real catalogs:
  - `product_categories` join table with unique `(productId, categoryId)`
- `products.brandId` may be nullable if “unbranded” products exist

## Inventory and warehouse correctness (variant-level)

### `warehouses`
Must include:
- `id` UUID PK
- `code` unique
- `name`

### `inventory_stocks`
Represents stock for a `variantId + warehouseId` pair.
Must include:
- unique constraint `(variantId, warehouseId)`
- `onHand` int (non-negative)
- `reserved` int (non-negative)
- `reorderLevel` int (>= 0)
- derived `available = onHand - reserved` (must never be negative under invariant checks)

Relational constraints:
- InventoryStock is the parent for:
  - `stock_reservations`
  - `inventory_movements`

### `stock_reservations`
Must include:
- `inventoryStockId` FK (non-null)
- `reservedQuantity` int
- `reservedAt`, `expiresAt`
- optional `releasedAt`
- one of:
  - `checkoutSessionId` FK
  - `paymentId` FK (if reservation is directly tied)
  - `orderId` FK (if order creation directly reserves)

Invariants:
- reservations are only valid when `expiresAt > now()` and `releasedAt` is null.
- releasing reservations must update `inventory_stocks.reserved` and append `inventory_movements`.

### `inventory_movements` (append-only)
Must include:
- FK `inventoryStockId`
- `movementType` enum:
  - RESERVATION
  - RESERVATION_RELEASE
  - DEDUCTION
  - RESTOCK
  - MANUAL_ADJUSTMENT_INCREASE
  - MANUAL_ADJUSTMENT_DECREASE
  - RETURN_RESTOCK
- `deltaOnHand`, `deltaReserved`
- `resultingOnHand`, `resultingReserved`
- optional `reason`, optional `actorAdminUserId`, optional links to order/payment/return

Constraints:
- must never be updated; only appended.

## Commerce workflow tables

### `carts`, `cart_items`
- `cart.userId` nullable (guest carts supported)
- `cart.guestTrackingKey` nullable but should be unique when present
- `cart_items` must have unique `(cartId, variantId)`

### `checkout_sessions`
Must include:
- `cartId` FK
- `userId` nullable
- `guestTrackingKey` nullable
- `checkoutIdempotencyKey` unique (scoped per user/cart, or globally if you prefer)
- checkout state metadata for revalidation

### `orders`, `order_items`
Must include:
- `orderNumber` unique (human-friendly identifier)
- `userId` nullable (guest orders)
- `guestTrackingKey` nullable
- `status` enum for order lifecycle

`order_items`:
- FK `orderId`
- FK `variantId`
- snapshots for title/pricing fields (store prices at order creation)

Order timeline:
- `order_status_history` is append-only transitions:
  - contains `fromStatus`, `toStatus`, `changedAt`, optional `actorAdminUserId`

### `cancellation_requests`
Cancellation requests are queue-driven and auditable:
- must include `orderId` FK
- `status` enum (PENDING_APPROVAL, APPROVED, REJECTED, COMPLETED)
- admin resolution fields:
  - `resolvedByAdminUserId`
  - `resolvedAt`
  - `reason/note`

## Financial truth tables

### `payments`
Must include:
- FK `orderId`
- `paymentState` enum aligned to the required state machine:
  - PENDING_INITIALIZATION
  - INITIALIZED
  - AWAITING_CUSTOMER_ACTION
  - PAID
  - FAILED
  - CANCELLED
  - REFUND_PENDING
  - PARTIALLY_REFUNDED
  - REFUNDED
- `idempotencyKey` uniqueness:
  - must prevent duplicate initialization/settlement writes

### `payment_attempts`, `payment_transactions`
- Attempts represent retries and must be linked to `paymentId`.
- Transactions represent provider evidence and must be append-only:
  - webhook payload reference must not overwrite prior records.

### `refunds`, `refund_items`
- refunds are linked to `paymentId`
- state machine aligned to:
  - pending approval
  - approved/rejected
  - provider-verified completed
- must store amounts and currency

### `financial_exceptions`
- finance-visible mismatches created when provider/ledger states diverge.
- must record mismatch summary in JSON.
- resolution is gated by admin permission and audited.

## Fulfillment/shipping tables

- `shipments` linked to `orderId` and `warehouseId`
- `shipment_tracking_events` append-only:
  - includes event timestamp and provider event payload or normalized status

## Returns tables

- `returns` linked to `orderId` with `status` state machine
- `return_items` linked to `order_item` to ensure item-aware return eligibility

## Support tables

### `support_tickets`
- supports customer or guest tickets
- supports linking to `orderId` (optional)
- status enum (OPEN, CLOSED)
- priority for SLA queue
- assignment fields to `adminUserId` (optional but should exist)

### `support_messages`
- time-ordered messages
- append-only
- must store author type and author link

## Promotions and content tables

### `coupons`
Must include:
- unique `code`
- status enum (ACTIVE, DISABLED, EXPIRED)
- windows (`activeFrom`, `activeTo`)
- redemption constraints (global and per-customer where supported)
- minimum order conditions and discount definition

### `coupon_redemptions`
- links coupon + user (or guest) + order
- unique constraints should prevent multiple redemptions beyond limit policies

### `promotions`, `promotion_rules`, `campaigns`
Promotion targeting is modeled as rule tables with JSON fields for flexibility:
- rules must be evaluated during checkout eligibility validation
- promotions must have activation windows

### `banners`, `cms_pages`
- store publish/unpublish governance state
- banners reference content blocks and media URLs

## Governance, audit, and observability tables

### Append-only audit layers
- `audit_logs`: general “what happened” audit for compliance
- `admin_action_logs`: sensitive mutation-specific audit with before/after
- `timeline_events`: cross-entity event stream used by admin/customer timelines

### Security, alerts, incidents
- `security_events`: suspicious login and risk-triggered findings
- `alerts`: operational/security alerts with ownership and status
- `incidents`: incident investigation objects
- `risk_signals`: scoring output for fraud/risk review screens

Relational constraints:
- alerts/incidents/security findings should be able to reference related entity IDs (order/payment/user/admin action) in JSON for flexible linking.

## Integration durability tables

- `webhook_events`: persisted raw webhook payload and verification outcome
- `webhook_processing_attempts`: each worker attempt outcome with retry count and error snapshot
- `job_runs`: worker/job execution evidence
- `reconciliation_runs`: optional ledger reconciliation evidence

Invariant:
- webhook events are persisted before enqueuing processing jobs.
- retries never overwrite prior processing outcomes; they only append attempts and update a derived “last status”.

## Runtime settings
- `system_settings` stores runtime governance controls as JSON values.
- settings are environment-like config *separated* from secrets.

