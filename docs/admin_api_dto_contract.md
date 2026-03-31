# Admin API DTO Contract (94-screen scope)

This contract defines the request/response DTO *shapes* for the admin API.

It complements:
- `docs/ecommerce_admin_api_contract_72screens.md` (route list)
- `docs/admin_error_code_catalog.md`
- `docs/admin_filter_and_sort_reference.md`
- `docs/admin_mutation_payload_reference.md`

## Base envelopes

### Success envelope
```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

### Error envelope
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

## Common DTO components

### Pagination meta
```json
{
  "page": 1,
  "page_size": 20,
  "total": 0,
  "total_pages": 0,
  "applied_filters": {}
}
```

### List response DTO
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 0,
      "total_pages": 0,
      "applied_filters": {}
    }
  }
}
```

### Detail response DTO (deep views)
```json
{
  "success": true,
  "data": {
    "entity": {},
    "related_entities": [],
    "timeline": [],
    "available_actions": [],
    "permission_hints": {}
  }
}
```

### Timeline/event DTO
```json
{
  "id": "uuid",
  "occurredAt": "2026-03-26T12:00:00.000Z",
  "eventType": "ORDER_STATUS_CHANGED",
  "actor": { "type": "ADMIN", "id": "uuid", "label": "Name" },
  "payload": {}
}
```

## DTO contract by endpoint family

### Admin Auth
#### `GET /api/admin/auth/me`
Response DTO:
```json
{
  "success": true,
  "data": {
    "admin": { "id": "uuid", "email": "a@b.com", "status": "ACTIVE" },
    "roles": [{ "id": "uuid", "code": "finance_admin" }]
  }
}
```

#### `GET /api/admin/auth/sessions`
Response DTO:
- `items[]`: `{ sessionId, deviceLabel, ipCountry, ipRegion, createdAt, lastActiveAt, revokedAt? }`

Sensitive mutations:
- `POST /api/admin/auth/sessions/revoke-all`
- `POST /api/admin/auth/sessions/:sessionId/revoke`
Request body:
```json
{ "reason": "Optional reason for audit", "note": "Optional note" }
```

### Dashboard
`GET /api/admin/dashboard/overview`
Response DTO (example):
```json
{
  "items": {},
  "widgets": [
    { "key": "sales", "value": 0, "deltaPct": 0, "timeRange": "7d" }
  ]
}
```

### Catalog
#### `GET /api/admin/products`
Filters (via common filter reference):
- `q`, `status`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`, `page`, `page_size`
Response `items[]`:
```json
{
  "id": "uuid",
  "slug": "string",
  "title": "string",
  "status": "DRAFT|PUBLISHED|ARCHIVED",
  "updatedAt": "iso",
  "inventorySummary": { "available": 0, "lowStock": false }
}
```

#### `POST /api/admin/products`
Request body (example):
```json
{
  "slug": "product-slug",
  "title": "string",
  "description": "string?",
  "brandId": "uuid?",
  "categoryIds": ["uuid"],
  "attributes": {}
}
```
Response:
```json
{ "entity": { "id": "uuid" } }
```

#### Sensitive: `POST /api/admin/products/:productId/publish|unpublish|archive`
Request body (per mutation reference):
```json
{ "reason": "string?", "note": "string?" }
```

#### `PATCH /api/admin/products/:productId`
Request body:
```json
{
  "title": "string?",
  "description": "string?",
  "brandId": "uuid?",
  "categoryIds": ["uuid"]
}
```

### Inventory
`GET /api/admin/inventory/overview`
Response DTO `entity`:
```json
{
  "totals": { "onHand": 0, "reserved": 0, "available": 0 },
  "lowStockCount": 0,
  "outOfStockCount": 0
}
```

`POST /api/admin/inventory/adjustments`
Request body:
```json
{
  "reason": "string",
  "note": "string?",
  "items": [
    { "variantId": "uuid", "warehouseId": "uuid", "deltaOnHand": 12 }
  ]
}
```

### Orders and Fulfillment
#### `GET /api/admin/orders`
Response items:
```json
{
  "id": "uuid",
  "orderNumber": "string",
  "status": "string",
  "paymentState": "PaymentState",
  "createdAt": "iso",
  "customer": { "id?": "uuid", "email?": "string", "guest": false }
}
```

#### `GET /api/admin/orders/:orderId/timeline`
Response:
`timeline[]` uses common timeline DTO.

#### Sensitive order cancel:
`POST /api/admin/orders/:orderId/cancel`
Request body:
```json
{ "reason": "string", "note": "string?" }
```

### Payments and Refunds
#### `GET /api/admin/payments/:paymentId/transactions`
Response:
`items[]`:
```json
{
  "id": "uuid",
  "status": "string",
  "providerRef": "string?",
  "amountCents": 0,
  "currency": "GHS",
  "createdAt": "iso",
  "payload": {}
}
```

#### Sensitive refund approve/reject:
`POST /api/admin/refunds/:refundId/approve|reject`
Request body (mutation reference):
```json
{
  "reason": "string",
  "note": "string?",
  "approvedAmountCents": 1999
}
```

### Customers
#### `GET /api/admin/customers/:customerId/risk`
Response example:
```json
{
  "entity": { "customerId": "uuid", "riskScore": 0.0, "summary": "string" },
  "signals": [],
  "timeline": []
}
```

#### Sensitive: suspend/reactivate
`POST /api/admin/customers/:customerId/suspend|reactivate`
Request body:
```json
{ "reason": "string", "note": "string?" }
```

### Support
#### `GET /api/admin/support/tickets/:ticketId`
Response:
```json
{
  "entity": { "id": "uuid", "status": "OPEN|CLOSED", "priority": "LOW|..." },
  "related_entities": [],
  "timeline": [],
  "available_actions": []
}
```

#### Reply (sensitive write but not a “governance action”)
`POST /api/admin/support/tickets/:ticketId/reply`
Request body:
```json
{ "message": "string" }
```

### Content and Marketing
Marketing lists should use common list meta and `status` filters.
Sensitive publish/unpublish actions use `{ reason?, note? }`.

### Security, Audit, Alerts, Incidents
Audit and security detail endpoints:
- must return `timeline[]`
- must return `entity` + `metadata` snapshots

Example resolution mutation body:
`POST /api/admin/alerts/:alertId/resolve`
```json
{ "reason": "string", "note": "string?" }
```

## Contract notes (implementation expectations)
1. Confirmation-backed actions must write:
   - `AuditLog` and `AdminActionLog` (append-only)
   - timeline events for the affected entity
2. List endpoints must include `applied_filters` in pagination meta.
3. Queue pages should also return a lightweight `queueSummary` block.
4. Machine-readable errors must map to `admin_error_code_catalog.md`.

