# Testing, Acceptance Criteria, and Invariants Pack

This doc is the “verification” layer that complements the foundation artifacts:
- `database_architecture.md`
- `relational_specification.md`
- `prisma_schema_v1.md` / `schema.prisma`
- `admin_api_dto_contract.md`

The goal is to make the platform implementation verifiable and to prevent the common failure mode:
> building controllers/UI first and discovering critical invariants later.

## Test layers (minimum recommended)
1. **Unit tests**
   - pure functions: eligibility decisions, idempotency key normalization, DTO validation.
   - invariants expressed as small, deterministic checks.
2. **Integration tests**
   - DB transactions and cross-table writes (Prisma).
   - RBAC enforcement and authorization middleware behavior.
3. **Queue/worker tests**
   - BullMQ job enqueue + retry behaviors.
   - webhook processing idempotency and outcome persistence.
4. **Smoke tests**
   - “happy path” end-to-end flows:
     - admin login -> one mutation -> audit logs exist
     - customer add-to-cart -> checkout validate -> create order -> initialize payment -> webhook processing -> order state finalized
5. **Staging verification**
   - provider sandbox/webhook tests
   - webhook signature tests
   - concurrency/load tests for inventory reservation

## Acceptance criteria by module (high priority)

### Inventory integrity
- Reservation must not oversell: under concurrent reservation attempts, `reserved` + `reservedDelta` must never exceed available stock.
- Release policy: when payment fails or checkout expires, reservations must be released and the inventory movements log must show:
  - `RESERVATION_RELEASE` matching the reservation that was released.
- Movement history is append-only:
  - no updates to existing movement records.

### Payments and refunds (idempotency + state machine)
- Frontend never marks payment successful.
- Webhook verification must be the final truth:
  - payment transitions to `PAID` only after verified webhook result.
- Duplicate callbacks:
  - repeated webhook deliveries for the same provider reference must not create duplicate settlement records.
- Refund approvals:
  - refund state transitions require admin permission and must be audited.

### RBAC enforcement
- Route-level permission gating fails with `FORBIDDEN` when missing permission.
- Sensitive mutations require confirmation + reason/note when policy demands it.
- Audit trail:
  - sensitive mutations always create `AdminActionLog` and a timeline event (or an equivalent timeline record).

### Webhooks and async processing
- Webhook handling pattern is enforced:
  - persist event -> verify signature -> enqueue processing -> worker updates outcome -> record retries.
- Worker retries:
  - retries append `WebhookProcessingAttempt` records and keep a derived “last known status” without overwriting history.

### Promotions/coupons
- Coupon eligibility is backend-driven:
  - frontend receives explicit eligibility flags.
- Coupon redemption limits:
  - per-customer and global redemption limits must be enforced server-side.

## Invariants that must be explicitly written down

### Financial invariants
1. **No double-settlement**:
   - For a given `payment.idempotencyKey`, settlement writes are performed at most once.
2. **Refund state separation**:
   - `Refund.refundState` must be distinct from `Payment.paymentState`.
3. **Reconciliation visibility**:
   - any mismatch between provider-verified outcome and internal expectation creates a `FinancialException` row.

### Inventory invariants
1. **available = onHand - reserved**:
   - derived “available” must never be negative after consistent transactional updates.
2. **append-only movement logs**:
   - `InventoryMovement` records are never updated once created.
3. **reservation lifecycle**:
   - reservation must have a valid `expiresAt` and must be released if payment fails/cancels/checkout expires.

### Order invariants
1. **Snapshot integrity**:
   - order item pricing/address snapshots are immutable after order creation.
2. **Separate state dimensions**:
   - order lifecycle state and payment state remain separate, only connected through verified outcomes.

### Security/RBAC invariants
1. **Backend-owned authorization**:
   - admin permission checks must be performed server-side, not inferred from UI.
2. **Audit requirements**:
   - sensitive changes include actor + reason where policy demands it.

### Webhook/job invariants
1. **Durable event persistence**:
   - webhook events are stored before processing.
2. **Retry is safe**:
   - worker retries never overwrite prior outcomes; they append attempts.

## Smoke test matrix (examples)
- Inventory:
  - Reserve -> Pay fails -> Reservation released -> Inventory available returns to baseline.
- Payments:
  - Initialize payment -> webhook paid -> order accepted for fulfillment.
  - Initialize payment -> duplicate webhook -> still one terminal paid record.
- Governance:
  - Attempt sensitive mutation with missing permission -> `FORBIDDEN`.
  - Repeat sensitive mutation with valid permission -> audit logs exist and contain reason/note.

## Document governance layer (keeping packs aligned)
When any contract/invariant changes:
- update the related foundation doc (DB or contract)
- update invariants in this pack
- update DTO contract where request/response changes
- update any error codes used by changed behavior

