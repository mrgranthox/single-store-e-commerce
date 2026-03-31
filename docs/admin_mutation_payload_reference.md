# Admin Mutation Payload Reference

This doc standardizes request bodies for sensitive admin mutations.

The admin UI can show reason/note inputs, but the backend is always the authority:
- permissions are checked server-side
- state transitions follow workflow rules
- audit log writes are captured for sensitive actions

## Common fields for sensitive mutations
- `reason` (string, optional depending on endpoint policy)
- `note` (string, optional; admin-facing internal notes)
- `expected_version` (number or string; optional if optimistic concurrency is implemented)

## Publishing/moderation actions (example pattern)
Used for publish/unpublish/archive/reject/hide operations:
```json
{
  "reason": "Optional policy reason for auditability",
  "note": "Optional internal note"
}
```

## Inventory adjustment actions
Used for manual adjustments and sensitive stock operations:
```json
{
  "reason": "Reason required by policy",
  "note": "Optional internal note",
  "variantId": "uuid",
  "warehouseId": "uuid",
  "deltaOnHand": 12
}
```

If the implementation supports “set to target” instead of delta, it should:
- still require `reason`
- still append an `InventoryMovement` record of the corresponding type

## Order cancellation actions
Approve/reject cancellation requests:
```json
{
  "reason": "Cancellation decision reason",
  "note": "Optional internal note"
}
```

## Refund approval/rejection actions
```json
{
  "reason": "Refund policy reason",
  "note": "Optional internal note",
  "approvedAmountCents": 1999
}
```

## Alert/incident resolution actions
```json
{
  "reason": "Why this alert was resolved/acknowledged",
  "note": "Optional investigation notes"
}
```

## Sensitive settings updates
```json
{
  "reason": "Policy change rationale",
  "note": "Optional operational note",
  "settings": {
    "checkout": { "guestCheckoutEnabled": true },
    "reviews": { "reviewWindowDays": 90 },
    "support": { "slaHours": 48 }
  }
}
```

## Webhook/job retries (approval + audit)
For retry endpoints, the backend should:
- require a reason/note when policy demands it
- classify retries as safe or unsafe based on job type and idempotency strategy

