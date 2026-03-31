# E-Commerce Missing Foundation Gaps Addendum
## Comprehensive closure plan for five critical documentation and implementation gaps

This document is a **foundation-gap addendum** for the e-commerce platform documentation set.

It is written specifically against the current project direction:

- **94-screen admin implementation direction**
- **50-screen customer web**
- **48-screen-range mobile support**
- **single-store now**
- **future multi-store ready**
- **promotions and coupons are mandatory**
- **no loyalty / rewards now**
- **modular monolith backend**
- **PostgreSQL + Prisma**
- **Redis + BullMQ**
- **Clerk for authentication**
- **backend-owned RBAC**
- **webhook-safe, queue-backed async processing**
- **auditability, observability, and operational monitoring**

This document addresses the five missing foundation gaps that still reduce implementation completeness:

1. Missing database architecture / relational specification / Prisma schema v1
2. Admin API contract is route-heavy but not DTO-complete
3. 72-screen vs 94-screen admin scope drift risk
4. Missing testing / acceptance criteria / invariants-by-module detail
5. Missing implementation verification and document-governance layer for keeping all packs aligned over time

This file does **not** replace the current architecture pack, API packs, UI specs, permissions matrix, or implementation pack.  
It fills the missing foundation layer so implementation can proceed with fewer blind spots and fewer future rewrites.

---

# 1. Missing Foundation Doc: Database Architecture, Relational Specification, and Prisma Schema v1

## 1.1 Why this is a major gap
The current documentation clearly assumes a strong underlying data model, but that model is not surfaced as a dedicated first-class implementation artifact.

That creates real implementation risk because the system is not small. It spans:
- admin operations
- catalog and merchandising
- inventory and warehouses
- carts and checkout
- orders and fulfillment
- payments and refunds
- customer accounts
- support and complaints
- promotions and coupons
- alerts, incidents, security events
- webhooks, jobs, and observability

Without a dedicated relational/database specification, developers are forced to infer core relationships from:
- routes
- UI screens
- module names
- endpoint naming
- general business text

That is not enough for a system with:
- financial workflows
- stock integrity rules
- role-aware admin actions
- queue-backed processing
- append-friendly audit requirements

## 1.2 What must exist
This gap should be closed by creating **three linked foundation artifacts**.

### A. Database architecture document
This should explain:
- domain boundaries
- state ownership
- major aggregate roots
- write-critical workflows
- append-only record families
- reconciliation-sensitive data flows
- transactional hotspots

### B. Relational specification
This should define, table by table:
- table name
- purpose
- primary key type
- major columns
- foreign keys
- indexes
- unique constraints
- mutability expectations
- retention or archival behavior
- lifecycle notes

### C. Prisma schema v1
This should be the implementation-grade schema that becomes the source of truth for:
- models
- enums
- relations
- nullability
- defaults
- indexes
- uniqueness
- cascade/restrict behavior

## 1.3 What the database architecture must cover for this platform
At minimum, it must explicitly model the following entity families.

### Identity and access
- users
- admin linkage or admin_users
- roles
- permissions
- role_permissions
- user_roles
- session metadata
- login events
- security events
- user status history

### Catalog
- products
- product_variants
- categories
- brands
- product_media
- product attributes if included
- product reviews
- moderation state / review state

### Inventory
- warehouses
- inventory_items
- inventory_movements
- stock_reservations
- inventory adjustment references if separated

### Carts and checkout
- carts
- cart_items
- checkout sessions or equivalent
- coupon applications or checkout pricing snapshots where useful

### Orders
- orders
- order_items
- order_addresses
- order_status_history
- order_notes
- order timeline events

### Payments
- payments
- payment_attempts
- payment_transactions
- refunds
- refund_items
- financial_exceptions

### Shipping and fulfillment
- shipments
- shipment items if needed
- shipment_tracking_events
- shipping_methods

### Returns
- returns
- return_items
- return_status_history
- return_attachments

### Support
- support_tickets
- support_messages
- support_attachments
- support_internal_notes
- support assignment or queue ownership tables if needed

### Promotions, coupons, content
- coupons
- coupon_redemptions
- promotions
- promotion_rules
- campaigns
- banners
- cms_pages

### Notifications
- notifications
- notification_deliveries
- notification_templates
- user_notification_preferences

### Audit, alerts, incidents, observability
- audit_logs
- admin_action_logs
- alerts
- incident records
- security events
- webhook_events
- webhook_processing_attempts
- job_runs
- reconciliation_runs
- integration health records if modeled

### Runtime configuration
- system_settings
- feature_flags if introduced now
- setting groups if needed

## 1.4 Relational rules that must be locked
The relational specification must explicitly define these project-wide rules.

### Key strategy
- UUIDs should be preferred for internal business entities
- human-readable references may be generated separately for order numbers, ticket numbers, coupon codes, etc.

### Timestamp policy
Use standard timestamps:
- `created_at`
- `updated_at`
- `deleted_at` only where soft delete is truly intended

### Append-only families
These should be treated as append-only or near-append-only:
- audit_logs
- admin_action_logs
- order_status_history
- inventory_movements
- payment_transactions
- login_events
- security_events
- webhook processing attempts
- reconciliation run history

### Archive vs delete
The spec must state clearly where records are:
- immutable
- archived
- soft-deleted
- hard-deleted only in narrow technical situations

For this platform, business records should rarely be hard-deleted.

### Transaction boundaries
The data architecture must identify operations that require database transactions, such as:
- order creation plus reservation creation
- payment verification plus order/payment mutation
- refund approval plus refund state writes
- stock adjustment plus movement record creation
- return completion plus restock decision

## 1.5 Prisma schema v1 must remove ambiguity around
The Prisma schema must make the following impossible to misunderstand.
- whether inventory is tracked at product level or variant level  
  - it must be **variant level**
- whether one order can have multiple payments  
  - **yes**
- whether one payment can have multiple provider transactions  
  - **yes**
- whether returns are item-aware  
  - **yes**
- whether coupons and promotions are separate  
  - **yes**
- whether RBAC lives in Clerk  
  - **no, backend owns RBAC**
- whether status enums are centralized and consistent  
  - **they must be**

## 1.6 What should be produced next
To fully close this gap, the documentation set should gain these artifacts (now added):
- `database_architecture.md`
- `relational_specification.md`
- `prisma_schema_v1.md` and the authoritative `schema.prisma`
- optionally `enum_catalog.md` if state/value sets need separate governance

## 1.7 Why this is scope-fit
This is not overengineering.  
For this system, the database layer is the foundation of:
- payments
- stock integrity
- support history
- promotions and redemptions
- incident visibility
- auditability

So this is not optional polish. It is missing core infrastructure documentation.

---

# 2. Admin API Contract Gap: Endpoint Coverage Exists, DTO-Grade Contract Detail Does Not

## 2.1 Why this is a major gap
The admin API contract is strong on route inventory, module grouping, and endpoint direction.  
That is useful, but it is not enough for implementation at the scale of a **94-screen admin**.

The admin is not a thin CRUD surface. It includes:
- operations queues
- timeline views
- analytics screens
- security workspaces
- incident workspaces
- exception and reconciliation flows
- system monitoring surfaces
- settings screens
- approval-based mutations

That means the admin needs more than “route names.”  
It needs **payload-grade contract detail**.

## 2.2 What is currently underdefined
Compared with what an implementation-grade admin contract should contain, the missing detail includes:
- request body schemas
- query parameter definitions
- response DTOs
- field types
- enum values
- list response meta
- filter sets
- sort keys
- empty-state behavior at contract level
- permission expectations per mutation
- reasons/confirmation payloads for sensitive actions
- error codes by workflow
- examples of nested detail payloads

## 2.3 What the admin API pack must additionally define
For every endpoint family, the admin API contract should be upgraded to include:

### A. Request definitions
- path params
- query params
- body fields
- required vs optional
- enum options
- validation constraints
- date handling rules
- filter formats
- pagination structure
- sort field support

### B. Response definitions
- envelope format
- `data`
- `meta`
- list item summaries
- detail payload structure
- timeline event arrays
- analytics KPI blocks where needed
- linked-entity summary shapes

### C. Error definitions
- not found
- unauthorized
- forbidden
- invalid state transition
- validation failure
- provider failure
- reconciliation mismatch
- conflict / duplicate processing
- retry-safe vs non-retry-safe classification

### D. Permission notes
For high-risk endpoints, the contract should state:
- minimum permission required
- whether reason field is required
- whether confirmation is required
- whether audit log is guaranteed
- whether the action is approval-only vs operational write

## 2.4 Which admin areas need DTO-level detail most urgently
The most urgent groups are the ones most likely to break implementation if left abstract.

### Payments and finance
Must define exact request/response DTOs for:
- payment list filters
- payment detail shape
- transaction timeline structure
- refund approval/rejection payloads
- refund detail summary
- finance exception resolution

### Inventory
Must define DTOs for:
- inventory overview
- low-stock queue
- out-of-stock queue
- movement history
- manual adjustment request
- warehouse detail
- warehouse inventory detail

### Orders and fulfillment
Must define DTOs for:
- orders list
- order detail
- order timeline
- fulfillment queue
- dispatch queue
- shipment detail
- shipment tracking event shape
- cancellation request resolution

### Customers
Must define DTOs for:
- customer overview
- activity timeline
- support history
- review history
- risk/security profile
- account actions

### Support
Must define DTOs for:
- ticket list
- ticket detail
- reply payload
- internal note payload
- assignment payload
- queue metrics shape
- SLA analytics

### Audit, security, alerts, incidents
Must define DTOs for:
- audit log explorer rows
- admin action log detail
- alert list/detail
- security event detail
- incident investigation workspace
- risk/fraud review responses

### System control and observability
Must define DTOs for:
- settings screens
- webhook monitoring
- jobs monitor
- integration health
- exception monitor

## 2.5 What form the missing admin API detail should take
The admin contract should evolve into a **contract pack**, not a single route list file.

Recommended additions:
- `admin_api_dto_contract.md`
- `admin_error_code_catalog.md`
- `admin_filter_and_sort_reference.md`
- `admin_mutation_payload_reference.md`

## 2.6 Example of the required depth
Take a route like:

`POST /api/admin/refunds/:refundId/approve`

A complete contract should specify:
- path param: `refundId`
- body:
  - `reason?`
  - `approvedAmount`
  - `internalNote?`
- preconditions:
  - refund must be in pending-review state
  - actor must hold refund approval permission
- side effects:
  - audit log write
  - admin action log write
  - notification enqueue
  - payment provider refund initiation or refund status update
- success response:
  - refund summary
  - updated state
  - linked payment summary
- errors:
  - refund not found
  - already approved
  - invalid amount
  - permission denied
  - provider unavailable

That level of detail should become normal for risky admin endpoints.

## 2.7 Why this is scope-fit
The admin surface is already large and operationally deep.  
Adding DTO-grade admin contracts does not expand product scope — it makes the current scope implementable.

---

# 3. Scope Drift Risk: 72-Core-Screen vs 94-Screen Admin Direction

## 3.1 Why this is a major gap
The current documentation set contains two different admin scope framings:
- **72 core screens** as the official implementation planning target in several admin docs
- **94 total route-ready / extended views** when analytics, governance, and monitoring are fully split out

That distinction made sense in earlier planning.  
But once the project explicitly decides to **build to the 94-screen direction**, continuing to leave both framings active in the documentation creates drift risk.

## 3.2 What can go wrong if this is not reconciled
If the distinction remains loose, different parts of the implementation can diverge:
- frontend may design/build to 94
- backend may only contract for 72
- RBAC may only account for 72 route families
- prompts may generate incomplete admin modules
- progress tracking may falsely claim “admin complete” at 72
- QA may not test the extended screens
- implementation estimates may undercount effort
- technical debt may appear because the 22 extra screens are treated as “later” even when they are now “in scope”

## 3.3 The project-wide reconciliation decision that must be written down
The documentation set must explicitly state:

### Final implementation decision
- **The project now uses the 94-screen admin direction as the active implementation target.**
- The previous 72-screen framing is retained only as a historical/core subset, not as the final admin build target.

This means:
- admin route design
- API design
- RBAC planning
- backlog planning
- QA planning
- README positioning

must all align to the 94-screen direction.

## 3.4 How to preserve the useful part of the old 72-screen framing
The 72-screen framing should not be deleted entirely.  
It still has value as a structural grouping.

Use it as:
- the **core operational subset**
- the basis for implementation waves
- a way to distinguish must-have operations from split-out extended observability/governance views

But the docs must say clearly:

> 72 = core subset  
> 94 = actual admin implementation target

## 3.5 What should be updated in the docs
The following doc areas should be updated or annotated.

### Admin expanded screen inventory
Add an explicit note:
- 94 is now the active implementation direction

### Admin frontend architecture
Update route architecture notes to reflect full 94-view target

### Admin API contract
Ensure route families exist for the extended system control/observability surfaces

### Permissions matrix
Confirm permissions cover the added 88–94 screens and any associated actions

### Master README
Use the 94-screen direction as the main summary, not the 72-screen subset

### Build prompts
Update prompt language so AI build instructions do not stop at 72 if 94 is the target

## 3.6 How backlog/planning should use this
Implementation should treat the 94-screen scope like this:

### Wave 1
Core shell, auth, dashboards, catalog, inventory, orders, customers

### Wave 2
Payments, support, promotions/coupons, reporting

### Wave 3
Audit, alerts, security events, incidents

### Wave 4
Settings, webhook monitor, jobs monitor, integration health/exception monitor

This preserves phased execution without pretending the final admin scope is still only 72.

## 3.7 What artifact should be added
Create a short but explicit memo:
- `admin_scope_reconciliation.md`

It should state:
- why both numbers existed
- what changed
- what the active target is now
- how implementation and QA should interpret the two numbers

## 3.8 Why this is scope-fit
This does not add features.  
It simply prevents mismatch inside the features already chosen.

---

# 4. Missing Test Strategy, Acceptance Criteria, and Invariants-by-Module

## 4.1 Why this is a major gap
The current doc set is strong on:
- architecture
- modules
- screen inventory
- API grouping
- roles and permissions
- implementation order

But it is still too light on:
- acceptance criteria
- invariants
- smoke tests
- failure-case verification
- module-level “definition of done”

That means implementation can happen, but quality assurance becomes improvised.

For a system with:
- stock reservation
- payments
- webhooks
- refunds
- support tickets
- admin approvals
- job retries
- incident visibility

that is risky.

## 4.2 What the missing verification layer must contain
A proper verification pack should include **three levels**.

### A. Acceptance criteria by module
For each business module, define what must be true before it is considered complete.

### B. Invariants by domain
These are rules that must never be violated.

### C. Test strategy and execution layers
Define:
- unit tests
- integration tests
- queue/worker tests
- smoke tests
- staging verification

## 4.3 Example acceptance criteria by module

### Auth and session
Complete when:
- customer login/logout works
- admin login/logout works
- session revocation works
- suspended users are blocked
- admin access is denied without backend role/permission

### Catalog
Complete when:
- products can be created, edited, published, archived
- variants can be managed
- media order is stable
- category/brand association works
- public catalog only exposes valid published/visible inventory

### Inventory
Complete when:
- stock adjustment writes movement records
- available stock is correct
- low-stock queue is correct
- reservation/release logic works
- no oversell occurs in tested concurrency scenarios

### Checkout and orders
Complete when:
- checkout validation recalculates totals
- order creation is idempotent
- item/address snapshots persist
- order history and timeline render correctly

### Payments
Complete when:
- payment init works
- verified webhook updates payment state
- duplicate webhooks do not duplicate effects
- refund flow updates finance state correctly

### Returns/refunds
Complete when:
- only eligible items can be returned
- return workflow states transition correctly
- refund approval is permission-protected
- restock decision is recorded correctly

### Support
Complete when:
- customer can create ticket
- admin can assign/reply
- internal notes are private
- SLA queues classify correctly

### Audit/security/observability
Complete when:
- sensitive mutations create logs
- webhook failures are visible
- job failures are visible
- critical errors hit Sentry
- incidents/alerts can be tracked through their states

## 4.4 Example invariants that should be explicitly written
These are system rules that must always hold.

### Financial invariants
- a payment cannot be marked paid twice
- refund total cannot exceed refundable amount
- order financial state must align with verified payment state

### Inventory invariants
- available = on_hand - reserved
- reserved cannot exceed on_hand
- stock deduction must create a movement record
- cancellation/payment failure must release reservations where required

### Order invariants
- order, payment, and fulfillment states are distinct
- illegal state transitions are rejected
- timeline writes accompany important state changes

### Security/RBAC invariants
- frontend visibility does not grant permission
- sensitive admin action without permission must fail server-side
- audit logging must exist for protected operations

### Webhook/job invariants
- duplicate webhook processing must not duplicate business side effects
- failed jobs must be traceable
- dead-letter or final-failure state must be visible

## 4.5 Recommended test layers

### Unit tests
Use for:
- pricing calculations
- eligibility checks
- state transition validators
- refund math
- promotion/coupon rule evaluation

### Integration tests
Use for:
- DB-backed module flows
- auth and RBAC middleware
- checkout/order/payment flows
- stock reservation logic
- webhook processing pipeline

### Queue/worker tests
Use for:
- enqueue -> process
- retry/backoff
- duplicate event handling
- reconciliation jobs

### Smoke tests
Use for staging/pre-release:
- login
- catalog browse
- cart add/update/remove
- checkout validation
- create order
- verify payment webhook
- enqueue + process worker job
- refund approval
- support ticket creation/reply
- settings read/write where allowed

## 4.6 What artifact should be added
Create a dedicated pack, such as:
- `testing_acceptance_and_invariants_pack.md`

That pack should contain:
- module-by-module acceptance criteria
- invariants catalog
- smoke test matrix
- staging release checklist

## 4.7 Why this is scope-fit
This does not add new business capability.  
It makes the chosen capability testable and verifiable.

---

# 5. Missing Implementation Verification and Documentation Governance Layer

## 5.1 Why this is a gap
Even with the other four fixed, the project can still drift if there is no clear rule for:
- which docs are authoritative
- how updates propagate
- what gets changed when scope changes
- how code and docs stay aligned
- how implementation completion is verified against the documentation set

This matters because the platform now spans:
- multiple app surfaces
- backend modules
- extended admin scope
- queue/workers
- contracts
- permissions
- operational rules

Without a governance layer, different docs become “mostly right” but not synchronised.

## 5.2 What this governance layer should define
It should clearly classify documentation into roles.

### A. Canonical scope docs
These define what exists:
- master README
- admin/customer scope inventories
- admin scope reconciliation memo

### B. Canonical behavior docs
These define how the system behaves:
- gap-closure pack
- database architecture / relational spec
- eligibility rules
- permissions matrix
- testing/invariants pack

### C. Canonical implementation docs
These define how code is built:
- backend implementation pack
- API contracts
- module build prompts
- developer README

## 5.3 What rules should govern updates
When one type of change happens, these docs must be updated together.

### If a screen is added/removed
Update:
- scope inventory
- frontend architecture/routes
- API contract
- permissions matrix
- README if it changes the headline scope

### If a new business rule is added
Update:
- gap-closure / behavior docs
- API contract if request/response is affected
- testing/invariants pack

### If a data model changes
Update:
- relational spec
- Prisma schema
- API contract if outputs change
- testing pack if invariants change

### If a role/permission changes
Update:
- permissions matrix
- admin API permission notes
- gap-closure pack if sensitive action policy changes

## 5.4 What “implementation verified” should mean
A module should not be considered done just because code exists.  
It should be considered done only when all of these are true:
- code exists
- relevant migration/schema support exists
- API contract is aligned
- permissions are aligned if admin-facing
- acceptance criteria are passed
- key invariants still hold
- docs are updated where applicable

## 5.5 What artifact should be added
Create:
- `documentation_governance_and_verification.md`

It should contain:
- document authority map
- update propagation rules
- definition of done for module completion
- code-vs-doc alignment checklist

## 5.6 Why this matters for your exact project
Because this project is large enough that “just remember to update the docs” will fail.

The governance layer helps prevent:
- screen/API mismatch
- README drift
- permission mismatch
- schema mismatch
- implementation prompts generating stale assumptions

## 5.7 Why this is scope-fit
This adds no new product features.  
It protects the clarity of the features already chosen.

---

# Final Priority Order for Closing These Five Gaps

If these five gaps are to be addressed in the most implementation-helpful order, use this sequence:

## Priority 1
**Database architecture + relational specification + Prisma schema v1**

Reason:
Everything else depends on correct data modeling.

## Priority 2
**Admin API DTO-grade contract pack**

Reason:
The admin is now 94 screens and needs payload-grade contracts, not just routes.

## Priority 3
**72 vs 94 admin scope reconciliation memo**

Reason:
This prevents project-wide scope drift while implementation begins.

## Priority 4
**Testing, acceptance criteria, and invariants pack**

Reason:
This makes module completion measurable and protects payments, inventory, and operational safety.

## Priority 5
**Documentation governance and verification layer**

Reason:
This keeps all other docs aligned during implementation and prevents silent drift.

---

# Final Position

These five gaps are not “nice to have.”  
They are the remaining missing foundation layer between:
- a strong architectural blueprint
- and a truly implementation-complete system pack

Once these are addressed, the project will have:
- clearer data truth
- clearer admin contract detail
- clearer scope alignment
- clearer verification standards
- clearer documentation discipline

That is the level of completeness needed for a system with:
- 94 admin screens
- 50 customer screens
- multi-surface backend contracts
- payments
- inventory
- support
- promotions and coupons
- queues, workers, and webhooks
- audit/security/system monitoring requirements
