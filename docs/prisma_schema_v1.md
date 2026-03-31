# Prisma Schema v1

## What this is
This document is the “foundation artifact” for the platform’s Prisma schema contract.

**Implementation artifact (authoritative):**
- `backend/prisma/schema.prisma`

The schema is intentionally designed to be:
- modular-monolith friendly (module-by-module service construction)
- retry/idempotency safe (unique idempotency keys where required)
- audit/timeline friendly (append-only event families)
- inventory-correct (variant + warehouse stock model with reservation/movement logs)
- multi-store-ready later via optional `storeId` fields

## Important modeling decisions encoded in `schema.prisma`
1. **Inventory tracked at variant level**
   - `InventoryStock` is keyed by `(variantId, warehouseId)`
   - `StockReservation` and `InventoryMovement` enforce reservation and movement evidence

2. **Payment state machine**
   - `Payment.paymentState` is a single authoritative enum aligned to required states
   - `Payment` has an idempotency uniqueness rule scoped to `(orderId, idempotencyKey)`

3. **Append-friendly history**
   - `TimelineEvent`, `AuditLog`, `AdminActionLog`, and `InventoryMovement` are modeled for append-only usage

4. **RBAC is backend-owned**
   - roles/permissions tables are separate and joinable
   - admin authorization is derived from stored role/permission assignments

## Next implementation step
Use the schema to generate the Prisma client and wire:
- repo/data access patterns
- validators/DTOs
- services that enforce invariants with transactions

If you want the schema *embedded* in this doc for easier copy/paste, say so and I’ll inline it.

