# Admin Error Code Catalog

This doc defines the machine-readable error codes returned by the admin API (`/api/admin/...` or `/api/v1/admin/...`, depending on the implementation route prefix).

All errors follow the common envelope:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## Authorization and identity
- `AUTH_REQUIRED`: Admin is not authenticated (no session/token).
- `FORBIDDEN`: Authenticated but missing permission for the route/action.
- `ACCOUNT_LOCKED`: Admin account locked.
- `ACCOUNT_SUSPENDED`: Admin account suspended/deactivated.

## Resource and workflow state
- `NOT_FOUND`: Entity does not exist.
- `INVALID_INPUT`: Payload shape/type is invalid.
- `VALIDATION_ERROR`: Zod/validator failure with field-level details.
- `INVALID_STATE_TRANSITION`: Attempted transition is not allowed by the workflow state machine.
- `CONFLICT`: Conflicting concurrent updates detected (optimistic concurrency or derived invariants).
- `DUPLICATE_PROCESSING`: The request is a retry of an operation that already completed (idempotency violation or known duplicate).

## Inventory and stock integrity
- `INVENTORY_OUT_OF_STOCK`: Reservation/availability could not satisfy the requested quantity.
- `INVENTORY_STATE_MISMATCH`: Inventory changed between validation and mutation.
- `OVERSEND_BLOCKED`: Reservation/deduction prevented oversell; return recovery guidance for the UI.

## Payments, refunds, and provider interactions
- `PROVIDER_FAILURE`: Payment/refund provider failure (decline, timeout, invalid response).
- `PAYMENT_ALREADY_SETTLED`: Payment is already in a terminal successful state (cannot re-settle).
- `PAYMENT_NOT_SETTLED`: Attempted finance action requires verified paid state.
- `REFUND_NOT_ELIGIBLE`: Refund approval/rejection cannot be performed due to refund state.
- `RECONCILIATION_MISMATCH`: Finance mismatch between internal ledger and expected provider outcomes.

## Webhooks, jobs, and async processing
- `WEBHOOK_SIGNATURE_INVALID`: Webhook signature verification failed.
- `WEBHOOK_ALREADY_PROCESSED`: Webhook event already processed for the relevant idempotency key.
- `JOB_RETRY_NOT_ALLOWED`: Retry blocked by policy/state.
- `JOB_EXECUTION_FAILED`: Worker failed; error captured for observability.
- `QUEUE_RATE_LIMITED`: Queue attempt rejected due to throttling.

## Governance/audit
- `AUDIT_WRITE_FAILED`: Audit/admin action log write could not be persisted.

## Common mapping rules
1. Route-level auth failures should prefer `AUTH_REQUIRED`/`FORBIDDEN`.
2. Workflow guard failures should prefer `INVALID_STATE_TRANSITION`.
3. Provider verification failures should prefer `PROVIDER_FAILURE`.
4. Idempotency/duplicate issues should prefer `DUPLICATE_PROCESSING`.

