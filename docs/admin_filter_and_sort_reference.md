# Admin Filter and Sort Reference

This doc is the shared query-parameter contract for the admin API.

It exists because admin list/queue views must be consistent:
- pagination is uniform
- filters use consistent names
- sorting keys are predictable

## Common pagination params
- `page` (number, integer, >= 1)
- `page_size` (number, integer, > 0, recommended max 100)
- response meta should include:
  - `page`, `page_size`, `total`, `total_pages`

## Common sorting params
- `sortBy` (string): server-recognized field key
- `sortOrder` (`asc` | `desc`)

If not provided:
- default to stable sort (e.g., `createdAt desc` or `updatedAt desc` depending on view)

## Common filter params by domain

### Status filtering
- `status` (string or enum): supports workflow/state tables

### Date ranges
- `dateFrom` (ISO8601 UTC string)
- `dateTo` (ISO8601 UTC string)

### Actor/assignee filtering
- `actorId` (UUID string): admin actor id for audit/action logs
- `assigneeId` (UUID string): admin assignee for queue views

### Entity references
- `entityId` (UUID string): filter by linked entity id
- `entityType` (string): optional when the endpoint supports multiple entity families

### Priority/severity filtering
- `priority` (LOW|MEDIUM|HIGH|URGENT)
- `severity` (INFO|LOW|MEDIUM|HIGH|CRITICAL)

### Search
- `q` (string): free-text search
- note: server decides whether `q` maps to multiple fields (title/slug/email/etc.)

## Queue views
Queue screens should support:
- `queueStatus` (optional): e.g. PENDING, READY, IN_PROGRESS, FAILED
- `assignedOnly` (boolean optional): defaults false

## Response meta (list endpoints)
Admin list responses must include:
```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0,
  "total_pages": 0,
  "applied_filters": {}
}
```

Queue pages additionally include:
```json
{
  "queueSummary": {
    "pending": 0,
    "inProgress": 0,
    "failed": 0
  }
}
```

