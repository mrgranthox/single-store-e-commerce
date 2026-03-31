# E-Commerce Database Architecture

## Purpose
This document defines the database architecture for the single-store e-commerce platform that supports:
- **94-screen admin** (control-heavy operational console)
- **50-screen customer web** (full public commerce experience)
- **48-screen mobile** (mobile commerce experience)

It is single-store *now* but includes forward-compatible extension points for multi-store *later*.

## Source of truth and invariants
The database is the system of record for:
- product availability and purchasability
- checkout eligibility (including pricing normalization)
- stock reservation/release/deduction correctness
- order state transitions and timelines
- payment verification outcomes (provider-webhook final truth)
- return/refund eligibility and state changes
- admin authorization outcomes (via RBAC)
- auditability and append-friendly operational history

Key invariants the DB must support:
- **Inventory integrity**: reservation and deduction happen in transactions and cannot oversell.
- **Append-friendly history**: timeline/audit/investigation data is write-once (or append-only) where possible.
- **Idempotency-safe state writes**: payment-safe operations must avoid duplicate settlement writes.
- **RBAC-enforced governance**: permission decisions must be derivable from stored admin role/permission assignments.

## Architecture layers (DB-centric)
1. **Identity and authorization**: customers/admin identity linkage, roles, permissions.
2. **Catalog and merchandising**: products, variants, media, categories, brands, moderation state.
3. **Inventory and fulfillment correctness**: stock-at-variant-level, reservations, movements, warehouses.
4. **Commerce workflow**: carts, checkout sessions, orders, shipments, cancellations.
5. **Financial truth**: payments, payment transactions, refunds, reconciliation/financial exceptions.
6. **Service workflows**: reviews, support tickets, returns and refunds, internal notes.
7. **Governance and observability**: audit logs, admin action logs, timelines, alerts/incidents/security events.
8. **Integration durability**: webhook events and job runs with retry outcomes.
9. **Runtime governance**: settings/feature flags and policy controls.

## Aggregate roots and ownership of state
The recommended modular monolith approach maps domain modules to DB aggregate roots.

### Identity aggregates
- `User`, `AdminUser`
- `Role`, `Permission`
- `RolePermission`, `AdminUserRole`
- `SessionMetadata` (customer and admin sessions)

Ownership rules:
- RBAC authorization is derived from `AdminUserRole` and `RolePermission`.
- Session revocation and status/lockout are enforced at DB policy level (backend-owned).

### Catalog aggregates
- `Product` (publish/archive state)
- `ProductVariant` (purchasable stock unit)
- `ProductMedia`
- `Category`, `Brand`
- `Review` moderation workflow

Ownership rules:
- publish/unpublish/archive must be sensitive/admin-audited actions.
- review publication/hide/reject is moderation-driven.

### Inventory aggregates
- `Warehouse`
- `InventoryStock` (variant + warehouse)
- `StockReservation` (checkout/order reservation)
- `InventoryMovement` (append-only stock mutation log)

Ownership rules:
- `InventoryStock` provides **available** stock via `onHand - reserved`.
- every stock mutation must create an `InventoryMovement` record.
- release rules exist for payment failure/expiry/cancellation.

### Commerce aggregates
- `Cart` and `CartItem`
- `CheckoutSession` and checkout validation snapshots
- `Order` and `OrderItem`
- `OrderStatusHistory` (append-only transitions)
- `CancellationRequest`

Ownership rules:
- cart totals are preview-only; checkout/order creation always revalidates.
- order transitions are recorded in timeline/status history.

### Financial aggregates
- `Payment` (authoritative state machine)
- `PaymentAttempt`
- `PaymentTransaction` (provider callback evidence)
- `Refund` and `RefundItem` mappings
- `FinancialException` (finance-visible mismatches)

Ownership rules:
- backend controls payment final truth via webhook verification outcomes.
- refunds are approval/governance gated by admin permissions.

### Fulfillment/shipping aggregates
- `Shipment` and `ShipmentTrackingEvent`

Ownership rules:
- cancellation of fulfillment and return intake are queue-driven and auditable.

### Service aggregates
- `Return` and `ReturnItem`
- `SupportTicket`, `SupportMessage`, `SupportAttachment`
- `SupportInternalNote` (optional but recommended)
- `Notification` / `NotificationDelivery`

Ownership rules:
- support and service workflows are SLA/priority queue-driven.
- ticket threads are time-ordered and audit-friendly.

### Governance and observability aggregates
- `AuditLog`, `AdminActionLog`
- `TimelineEvent` (cross-entity event stream)
- `Alert`, `Incident`, `SecurityEvent`, `RiskSignal`
- `WebhookEvent` and `WebhookProcessingAttempt`
- `JobRun` and optional `ReconciliationRun`
- `SystemSetting`

Ownership rules:
- sensitive actions require actor context and reason fields when appropriate.
- alerts/incidents tie to underlying entities (order/payment/security/admin action).

## Append-only history strategy

The platform includes multiple “history” layers. The DB design should distinguish between:

### 1) Timeline/event streams (customer/admin UX timelines)
Used for:
- order timeline views
- admin action logs explorer
- payment/refund progression views
- security/audit investigations

DB recommendation:
- model the timeline as `TimelineEvent` rows with `entityType`, `entityId`, `eventType`, `occurredAt`, and a JSON `payload`.
- write-once semantics: timeline rows should never be updated; only appended.

### 2) Audit logs (governance-grade, append-friendly)
Used for:
- compliance-grade traceability
- “who did what and why” views
- audit explorers and investigations

DB recommendation:
- model `AuditLog` and `AdminActionLog` as append-only.
- sensitive actions should always provide a `reason` and store immutable before/after snapshots where applicable.

### 3) Inventory movement logs (append-only stock mutation evidence)
Used for:
- inventory movement history screens
- low-stock and discrepancy investigation

DB recommendation:
- model `InventoryMovement` as append-only.
- never overwrite computed movement history; recompute “current stock” from `InventoryStock` fields plus the movement log.

## Idempotency and retry safety (DB support)
The system must be safe under:
- webhook retries
- job retries
- client retry of payment/checkout init

DB support:
- add unique constraints (or idempotency tables) for operations that must not duplicate settlement writes.
- recommended patterns:
  - `Payment` has an idempotency key scoped to `orderId` (and/or attempt type).
  - webhook processing stores a persistent `WebhookEvent` and appends `WebhookProcessingAttempt` records with retry outcomes.
  - inventory reservations have expiry timestamps so “abandoned checkouts” can be released safely.

## Multi-store extension points (future-ready)
Single-store is implemented now. However, the DB schema should reserve future fields:
- optional `storeId` on entities where store scoping is expected later (products, inventory stock, pricing/availability, promotions, settings).

The current scope uses:
- default single store behavior
- no store switching UX

## Implementation notes for the modular monolith
In the modular monolith:
- Controllers should only translate request DTOs into service calls.
- Services should coordinate transactions and write:
  - state (e.g., orders/payments/inventory)
  - timeline/audit/notifications (as required)
- Each write path should be paired with:
  - explicit permission checks (RBAC)
  - explicit reason/note capture for sensitive operations
  - explicit idempotency handling for payment-safe operations

