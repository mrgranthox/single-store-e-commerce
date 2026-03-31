# E-Commerce Scope Gap Closure Pack
## Production-fit resolutions for the current single-store scope

**Purpose**  
This document closes the main design and implementation gaps identified across the current e-commerce system pack. It stays within the present scope: **94-screen admin**, **50-screen customer web**, **single-store now**, **future multi-store ready**, **queue-backed backend**, **role-based admin**, and **backend-driven eligibility**.

**What this document does**
- resolves missing behavioral decisions that would otherwise cause configuration and implementation bottlenecks
- fills underdefined operational logic without expanding the product beyond current scope
- keeps room for future growth where useful, but does not force out-of-scope features now

**What this document does not do**
- redesign the architecture stack
- add loyalty/rewards now
- add multi-store behavior now
- replace the existing API, UI, or backend packs

---

## 1. Auth, Session, and Core Security Model

### Gap being closed
The pack defines login, forgot password, reset password, logout, session pages, and admin security views, but it does not fully lock:
- session strategy
- account lockout behavior
- rate limiting and brute-force controls
- device/session visibility rules
- email verification enforcement
- risk-triggered auth responses

### Resolution for current scope
Use a **hybrid identity model**:
- **Clerk** handles authentication, session issuance, password reset, email verification, and user identity lifecycle.
- **The backend remains the source of truth** for application users, admin users, roles, permissions, status, suspension state, and sensitive action authorization.

### Required decisions
1. **Separate identity from authorization**
   - `clerk_user_id` is the external identity key.
   - backend user records store business state, role assignments, customer profile data, support linkage, and risk/security flags.
2. **Admin access is separate from customer access**
   - same underlying identity provider can be used
   - backend decides whether a signed-in identity may access customer routes, admin routes, or both
3. **Session visibility**
   - show active sessions with:
     - device label
     - browser / OS summary if available
     - IP country / region approximation if available
     - created at
     - last active at
   - allow revoke current session, revoke selected session, revoke all other sessions
4. **Account status**
   - backend statuses:
     - `ACTIVE`
     - `PENDING_VERIFICATION`
     - `SUSPENDED`
     - `LOCKED`
     - `DEACTIVATED`
5. **Lockout and throttling**
   - customer login attempts: soft rate limit first, temporary lock after repeated failures
   - admin login attempts: stricter threshold and longer lock window
6. **Email verification**
   - customer purchase and support can be allowed before verification if business wants low friction, but account risk-sensitive actions should still check verification state
   - admin accounts must be verified before admin access is granted

### Required backend data
- `users`
- `admin_users`
- `login_events`
- `security_events`
- `session_metadata`
- `user_status_history`

### Required operational rules
- every login attempt writes a `login_event`
- suspicious login patterns create `security_events`
- admin login lockouts must be visible in security dashboards
- revoked sessions must stop working immediately at backend policy level

### Why this fits the scope
This does not add advanced zero-trust systems. It simply makes the existing auth and session screens real and operationally safe.

---

## 2. Payment State Machine and Financial Flow Rules

### Gap being closed
The current pack includes payments, refunds, investigations, webhooks, and provider abstraction, but it does not fully lock a formal payment lifecycle.

### Resolution for current scope
Use one authoritative payment state machine and keep provider payloads mapped into internal states.

### Internal payment states
- `PENDING_INITIALIZATION`
- `INITIALIZED`
- `AWAITING_CUSTOMER_ACTION`
- `AUTHORIZED` *(only if provider/payment method needs it)*
- `PAID`
- `FAILED`
- `CANCELLED`
- `REFUND_PENDING`
- `PARTIALLY_REFUNDED`
- `REFUNDED`

### Rules
1. **Frontend never marks payment successful**
   - frontend may receive a provider callback result for UX only
   - final truth comes from verified backend webhook / provider verification
2. **One order can have multiple payment attempts**
   - useful for retries after failure
   - one payment record may have multiple provider transaction events
3. **Order confirmation policy**
   - recommended now: order is created in pending state before payment completion
   - order becomes financially confirmed only after verified paid state
4. **Duplicate payment protection**
   - checkout and payment initialization must require idempotency keys
   - payment verification must reject duplicate settlement writes
5. **Refund policy**
   - refunds can be:
     - full
     - partial
   - refund state is separate from payment state history and must also create transaction records
6. **Manual finance operations**
   - refund approval, exception resolution, and manual reconciliation actions require explicit permission and audit log

### Required backend data
- `payments`
- `payment_transactions`
- `payment_attempts`
- `refunds`
- `refund_items` or refund line mappings
- `financial_exceptions`

### Required admin capabilities
- view payment summary
- view provider transaction timeline
- view failure reason and provider reference
- approve / reject refund
- mark reconciliation done
- flag suspicious or mismatched payment states

### Scope guardrail
No subscription billing engine now. No saved card vault now. No split-tender complexity now.

---

## 3. Inventory Consistency, Reservation, and Release Logic

### Gap being closed
Inventory entities exist, but the system does not fully lock when stock is reserved, released, deducted, or restocked.

### Resolution for current scope
Use **variant-level inventory** with explicit reservation and release rules.

### Required stock model
For each inventory item / variant / warehouse combination:
- `on_hand`
- `reserved`
- `available = on_hand - reserved`
- `reorder_level`
- `status`

### Reservation policy for current scope
- **do not reserve at add-to-cart**
- **reserve at checkout/order creation when payment initialization begins**
- release reservation when:
  - payment fails
  - payment window expires
  - order is cancelled before fulfillment
- deduct permanently when:
  - payment verified and order accepted for fulfillment
  - or at dispatch if business chooses deferred deduction
- restock when:
  - approved return is completed and item condition allows restock

### Required rules
1. **Overselling prevention**
   - reservation and deduction must be done inside transactions
2. **Inventory movements are append-only**
   movement types:
   - reservation
   - reservation_release
   - deduction
   - restock
   - manual_adjustment_increase
   - manual_adjustment_decrease
   - return_restock
3. **Manual adjustment**
   - requires reason
   - requires permission
   - creates audit + movement record
4. **Low-stock detection**
   - based on `available`, not `on_hand`

### Required backend data
- `inventory_items`
- `inventory_movements`
- `stock_reservations`
- optional `reservation_expiry_jobs`

### Scope guardrail
No multi-location stock allocation engine beyond current warehouse support. No supplier procurement system now.

---

## 4. Cart, Checkout, and Checkout Failure Handling

### Gap being closed
Cart and checkout are defined, but the pack does not fully specify edge behavior when stock, price, coupon, or shipping conditions change mid-flow.

### Resolution for current scope
Use a backend-revalidated checkout every time a purchase is attempted.

### Rules
1. **Cart is not authoritative**
   - cart totals are preview values only
   - checkout validation recalculates:
     - item prices
     - discounts
     - shipping
     - tax if applicable
     - stock eligibility
2. **Cart expiry**
   - cart itself can remain, but reserved stock created during checkout must expire
3. **Price changes**
   - if a price changed after cart add:
     - return `priceChanges[]`
     - block final order creation until user accepts updated totals
4. **Stock changes**
   - if any line is unavailable:
     - return `stockIssues[]`
     - mark blocked items
5. **Coupon rules**
   - no coupon stacking unless explicitly enabled later
   - one primary coupon/promo path now
6. **Guest checkout**
   - allowed only if backend setting enables it
   - guest path must still create enough identity data for order retrieval and support
7. **Cart merge after login**
   - if guest cart + account cart both exist:
     - merge by product/variant when safe
     - if conflict, preserve higher quantity only if inventory allows
     - otherwise return merge warnings

### Required API outputs
Checkout validation should always return:
- normalized totals
- shipping options
- blocked items
- warnings
- eligibility flags
- user-facing messages

### Required worker support
- reservation expiry jobs
- abandoned checkout cleanup jobs later if needed

### Scope guardrail
No marketplace/cart-per-store logic now. No advanced promotion stacking engine now.

---

## 5. Order Lifecycle and State Transition Rules

### Gap being closed
The pack mentions separate order, payment, and fulfillment states, but the allowed transitions are not fully locked.

### Resolution for current scope
Use three separate state dimensions:

### A. Order status
- `DRAFT`
- `PENDING_PAYMENT`
- `CONFIRMED`
- `PROCESSING`
- `COMPLETED`
- `CANCELLED`
- `CLOSED`

### B. Payment status
- `UNPAID`
- `PENDING`
- `PAID`
- `FAILED`
- `PARTIALLY_REFUNDED`
- `REFUNDED`

### C. Fulfillment status
- `UNFULFILLED`
- `ALLOCATED`
- `PICKING`
- `PACKED`
- `SHIPPED`
- `DELIVERED`
- `RETURN_REQUESTED`
- `RETURNED`

### Transition rules
1. `DRAFT -> PENDING_PAYMENT` at checkout order creation
2. `PENDING_PAYMENT -> CONFIRMED` only after verified payment
3. `CONFIRMED -> PROCESSING` when accepted into fulfillment pipeline
4. `PROCESSING -> COMPLETED` after fulfillment is delivered and business completion logic is satisfied
5. cancellation rules:
   - allowed only before shipment / fulfillment lock
6. return rules:
   - allowed only after delivery and inside policy window

### Required data
- `orders`
- `order_items`
- `order_addresses`
- `order_status_history`
- `order_notes`
- `order_timeline_events`

### Admin requirement
All manual status overrides require:
- permission
- reason where high-risk
- audit log
- before/after capture

### Scope guardrail
No order editing after payment beyond cancellation/return/refund workflows. No split-order orchestration beyond the existing future-ready shipment flexibility.

---

## 6. Returns, Refunds, and Post-Purchase Service Rules

### Gap being closed
Returns and refunds exist in the pack, but key business rules are not fully fixed.

### Resolution for current scope
Support a straightforward, auditable returns model.

### Return rules
1. Return eligibility is backend-driven by:
   - order delivered state
   - policy window
   - per-line item eligibility
   - prior return state
2. Return request stages:
   - `REQUESTED`
   - `UNDER_REVIEW`
   - `APPROVED`
   - `REJECTED`
   - `RECEIVED`
   - `COMPLETED`
3. Return reasons should use a controlled list plus optional notes
4. Evidence upload can be optional now, but model should allow attachments later

### Refund rules
1. Refund can be tied to:
   - full return
   - partial return
   - cancellation
   - manual finance correction
2. Refund amount components should be separate:
   - item subtotal
   - shipping refund
   - tax refund if relevant
   - manual adjustment
3. Restocking rule
   - refund completion does not automatically restock
   - restock depends on warehouse intake and item condition

### Required data
- `returns`
- `return_items`
- `return_status_history`
- `refunds`
- `refund_items`
- `return_attachments`

### Scope guardrail
No exchange flow now. No advanced RMA portal beyond existing return request wizard and admin handling.

---

## 7. Webhook Architecture, Retry Rules, and Dead-Letter Handling

### Gap being closed
The pack correctly requires webhook verification and idempotency, but retry and operational visibility are not fully specified.

### Resolution for current scope
Use a durable webhook pipeline:

1. API receives webhook
2. verify signature
3. persist raw event
4. respond fast
5. enqueue processing job
6. worker processes event idempotently
7. mark event result

### Required webhook event statuses
- `RECEIVED`
- `VERIFIED`
- `INVALID_SIGNATURE`
- `QUEUED`
- `PROCESSING`
- `PROCESSED`
- `FAILED`
- `DEAD_LETTERED`

### Retry policy
- exponential backoff
- bounded retry count
- after final failure -> dead-letter status
- manual replay action from admin system monitoring tools later

### Required admin/system visibility
- failed webhook count
- invalid signature count
- replay candidates
- provider source
- event type
- first seen / last retry / final status

### Required data
- `webhook_events`
- `webhook_processing_attempts`
- `dead_letter_jobs` or status-based dead-letter handling

### Scope guardrail
No separate event bus platform now. Queue-backed processing is enough.

---

## 8. RBAC, Permission Boundaries, and Sensitive Action Governance

### Gap being closed
The permissions matrix is strong, but implementation boundaries need to be locked.

### Resolution for current scope
Backend authorization must be permission-code based, not role-name based only.

### Rules
1. Every admin request resolves:
   - admin identity
   - active roles
   - permission codes
2. Route visibility in frontend is advisory only
3. Backend is the final authority for:
   - product publish/archive
   - inventory adjustments
   - order cancellation override
   - refund approval
   - customer suspension/reactivation
   - settings writes
   - integration retries
4. Read access and action access are separate
5. Support roles may inspect more than they may mutate

### Required permission design
Examples:
- `catalog.products.read`
- `catalog.products.write`
- `catalog.products.publish`
- `inventory.adjust`
- `orders.cancel`
- `refunds.approve`
- `customers.suspend`
- `security.audit.read`
- `settings.write`
- `integrations.retry`

### Required data
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- optional `permission_groups` for admin UX later

### Scope guardrail
No temporary delegated admin access flow now. No tenant-aware role partitioning now.

---

## 9. Audit Logs, Action Logs, and Timeline Schema

### Gap being closed
Audit exists conceptually, but the event model is not unified.

### Resolution for current scope
Create three related but distinct logging layers:

### A. Audit logs
For security/compliance-grade records:
- actor
- action
- entity type/id
- timestamp
- ip/request metadata
- reason where provided

### B. Admin action logs
For high-risk before/after mutations:
- old value snapshot
- new value snapshot
- field change summary
- linked audit log id if useful

### C. Entity timeline events
User-facing or admin-facing business history:
- order placed
- payment verified
- shipment dispatched
- return requested
- refund completed

### Correlation requirement
Every API request and queued job should carry a correlation/request ID so:
- webhook processing
- worker execution
- payment updates
- audit logs
can be traced together.

### Required data
- `audit_logs`
- `admin_action_logs`
- `timeline_events`
- `request_logs` or request metadata in structured logs

### Scope guardrail
No full SIEM integration now. Just make internal traceability correct.

---

## 10. Notifications and Delivery Rules

### Gap being closed
Notifications are mentioned, but not strongly modeled.

### Resolution for current scope
Support **email first**, with an extensible notification framework.

### Notification event types for now
- account verification
- password reset
- order confirmation
- payment confirmation
- payment failure
- shipment dispatched
- delivery completed
- return status changed
- refund status changed
- support ticket created
- support ticket replied
- low-stock alert to admins
- security alert to admins

### Rules
1. Notifications are queued, not sent inline on request path
2. Notification delivery result must be tracked
3. Users can have communication preferences for marketing later, but transactional messages stay enabled when legally/operationally required
4. Support/admin alerts can be role-targeted

### Required data
- `notifications`
- `notification_deliveries`
- `notification_templates`
- `user_notification_preferences`

### Scope guardrail
No SMS or push system now, but the event model should allow future channels.

---

## 11. Search, Filtering, and Catalog Discovery Rules

### Gap being closed
The customer and admin frontends assume rich filtering/search, but the search backend strategy is not locked.

### Resolution for current scope
Start with **database-backed search and indexed filtering**, not an external search engine.

### Rules
1. Public catalog search supports:
   - text search across product fields
   - category/brand filters
   - price range
   - availability
   - sorting
2. Admin search supports:
   - product name
   - SKU
   - customer identity fields as allowed
   - order number
   - payment references where relevant
3. Use indexed database columns and pragmatic query design first
4. Reserve a future abstraction layer so external search (Meilisearch/Elasticsearch/OpenSearch) can be added later without rewriting API shapes

### Required implementation decisions
- define searchable fields now
- define sort keys now
- define filter names now
- define pagination contract now

### Scope guardrail
No external search service now unless performance later demands it.

---

## 12. Media, Upload, and File Storage Rules

### Gap being closed
Media management exists in UI and API scope, but operational storage rules are underdefined.

### Resolution for current scope
Use **S3-compatible or Cloudinary-like managed storage** with strict upload validation.

### Rules
1. Product media and support attachments are distinct file classes
2. Validate on upload:
   - mime type
   - file size
   - allowed extensions
3. Store metadata in database:
   - asset id
   - storage key/url
   - file size
   - mime type
   - width/height when relevant
   - uploaded by
4. Product media supports:
   - ordering
   - primary image
   - optional variant mapping
5. Support attachments must be access-controlled

### Required data
- `media_assets`
- `product_media_links`
- `support_attachments`

### Scope guardrail
No in-app image editor now. No DAM system now. Keep model clean enough to expand later.

---

## 13. System Settings, Config Governance, and Feature Flags

### Gap being closed
The admin scope includes settings pages, but the backend configuration model is not fully formalized.

### Resolution for current scope
Split config into two categories:

### A. Environment secrets/config
Managed outside DB:
- provider secrets
- DSNs
- API keys
- database/redis URLs

### B. Runtime business settings
Managed inside DB:
- guest checkout enabled
- return window days
- low-stock threshold defaults
- support SLA targets
- review moderation mode
- webhook retry policy values if desired
- maintenance banners if desired

### Rules
1. Sensitive secrets never live in the admin UI
2. Runtime settings changes create audit logs
3. Settings should be grouped and strongly typed, not loose key/value chaos if avoidable

### Required data
- `system_settings`
- optional `setting_groups`
- optional `feature_flags`

### Loyalty/rewards note
Do **not** implement rewards now, but reserve:
- a future `reward_settings` / `loyalty_settings` group
- a feature flag namespace for future customer incentives

### Scope guardrail
No full remote config platform now. Just enough governed runtime settings for the current system.

---

## 14. Analytics, Event Tracking, and Reporting Backbone

### Gap being closed
Analytics screens exist, but event generation and aggregation are not concretely defined.

### Resolution for current scope
Define a lightweight analytics event layer plus scheduled or query-time aggregation.

### Event classes for now
- catalog events
- order events
- payment events
- refund/return events
- support events
- admin action events
- security events

### Rules
1. Operational systems remain source of truth
   - do not build analytics-only truth separate from core tables
2. Use append-friendly event records for important actions
3. Use async aggregation where expensive dashboards need precomputed metrics
4. Distinguish:
   - operational dashboards (near-real-time from core data)
   - report dashboards (can be computed asynchronously)

### Required data
- `analytics_events`
- optional `daily_aggregates`
- optional `report_runs`

### Scope guardrail
No heavy event streaming platform now. No separate data warehouse now.

---

## 15. Error Taxonomy, Response Contracts, and Retry Classification

### Gap being closed
The docs mention consistent envelopes, but not a complete error policy.

### Resolution for current scope
Define:
1. standard error envelope
2. stable machine-readable error codes
3. retry classification rules
4. UX-facing error message strategy

### Error categories
- validation errors
- auth/authz errors
- eligibility/business-rule errors
- provider/integration errors
- conflict/idempotency errors
- system/internal errors

### Rules
1. Every module must use shared envelope format
2. Error codes should be namespaced where useful:
   - `AUTH_INVALID_CREDENTIALS`
   - `CHECKOUT_STOCK_CHANGED`
   - `PAYMENT_ALREADY_VERIFIED`
   - `RETURN_NOT_ELIGIBLE`
3. Retryable vs non-retryable must be explicit for workers and integrations

### Required implementation
- central error registry
- shared exception mapper
- standardized HTTP status mappings
- worker error classification helpers

### Scope guardrail
No massive i18n message system now. Just make API messages stable and clear.

---

## 16. Customer Experience Logic That Must Be Backend-Driven

### Gap being closed
Customer flows are strong, but some operational behaviors still need explicit backend logic.

### Resolution for current scope
Backend must own:
- checkout eligibility
- cancellation eligibility
- return eligibility
- review eligibility
- guest tracking eligibility
- support reply eligibility

### Additional current-scope decisions
1. **Address handling**
   - support multiple saved addresses
   - one default shipping address
   - one default billing address if needed
2. **Delivery ETA**
   - provide simple estimated delivery windows from shipping method and location logic
   - do not build advanced route intelligence now
3. **Order modification**
   - no general post-placement item editing now
   - use cancellation + reorder pattern
4. **Saved items / wishlist**
   - can exist without changing purchase eligibility rules
5. **Future rewards room**
   - add placeholder account summary region / feature flag capability
   - do not build rewards ledger now

### Scope guardrail
No subscriptions, loyalty, or wallet balance now. Keep account center focused on real current flows.

---

## 17. Performance, Caching, and Scalability Rules

### Gap being closed
The system is broad, but no explicit performance policy is locked.

### Resolution for current scope
Adopt targeted caching and query discipline.

### Caching rules
1. Cache public, read-heavy catalog/content responses with safe TTLs
2. Do not cache sensitive or fast-changing account/order/admin views aggressively
3. Use Redis for:
   - short-lived catalog cache
   - rate-limit counters
   - idempotency keys
   - queue data
4. Large analytics/report queries should not run inline on every page load if they become slow

### Database/query rules
- paginate all large list endpoints
- sort only on supported indexed columns
- avoid N+1 fetch patterns
- add indexes for:
  - order number
  - payment reference
  - sku
  - status fields
  - created_at / updated_at
  - commonly filtered foreign keys

### Scope guardrail
No premature microservices. No CDN-heavy optimization beyond normal media delivery.

---

## 18. Testing Strategy Required for This Scope

### Gap being closed
Implementation docs guide coding phases, but not a sufficient testing baseline.

### Resolution for current scope
Use four test layers:

### A. Unit tests
For pure business rules:
- eligibility evaluators
- state transition validators
- pricing calculations
- refund calculations

### B. Integration tests
For module + DB behavior:
- auth guards
- role/permission checks
- order creation
- payment webhook processing
- reservation/deduction logic

### C. Queue/worker tests
- enqueue -> process -> success/failure
- retry behavior
- idempotent duplicate event handling

### D. Contract/smoke tests
- core endpoints return expected envelopes
- admin and customer critical flows remain stable

### Scope guardrail
No huge end-to-end browser suite required on day one, but critical smoke coverage is required.

---

## 19. Deployment, Environment, and Operational Release Rules

### Gap being closed
The documents recommend stack and modules, but release behavior is not strongly locked.

### Resolution for current scope
Use three environments:
- local development
- staging
- production

### Rules
1. Migrations run before release is declared healthy
2. Worker and API versions must be compatible
3. Health endpoints required:
   - `/health`
   - `/ready`
4. Staging must test:
   - login
   - checkout validation
   - webhook path
   - queue processing
   - refund and support critical actions
5. Secrets are environment-managed, never checked into repo
6. Production rollback must prioritize schema safety

### Required operational capabilities
- release logging
- migration audit
- failed deploy visibility
- worker crash visibility

### Scope guardrail
No blue/green deployment complexity required yet. Keep release flow disciplined but simple.

---

## 20. Data Consistency, Transaction Boundaries, and Reconciliation Jobs

### Gap being closed
This is the final core gap: how the system behaves when multiple modules interact and something partially fails.

### Resolution for current scope
Use explicit transaction boundaries plus reconciliation jobs.

### Transaction boundaries
Use DB transactions for:
- order creation + reservation creation
- payment verification + order/payment state update
- refund approval + refund state mutation
- stock adjustments + movement writes

### Eventual consistency rules
Some actions can be async, but must still converge safely:
- email sending
- analytics writes
- low-stock alerts
- some support/admin notifications

### Required reconciliation jobs
At minimum:
1. payment reconciliation
   - detect orders stuck in pending payment but provider says paid/failed
2. reservation expiry cleanup
   - release stale reservations
3. webhook failure reconciliation
   - detect verified-but-not-processed events
4. notification retry cleanup
5. optional low-stock scan

### Required data
- `job_runs`
- `reconciliation_runs`
- `system_incidents` or operational issue records later if desired

### Scope guardrail
No distributed saga framework now. A modular monolith with transactions + queue workers + reconciliation jobs is enough for this scope.

---

# Final Implementation Position

This document closes the missing layer between:
- architecture
- UI/API scope
- real-world operational behavior

With these twenty resolutions adopted, the current system becomes:
- implementable without major hidden policy gaps
- safer for payments and inventory
- clearer for RBAC and auditability
- consistent with current admin and customer scope
- ready for phased development without unnecessary redesign

## Priority order for applying these resolutions
1. Auth/session model
2. RBAC and permissions
3. Error/response standard
4. Database + Redis + worker baseline
5. Order/payment/inventory state rules
6. Webhook/idempotency/reconciliation
7. Audit/timeline/logging
8. Returns/refunds/support logic
9. Notifications/search/media/settings
10. analytics/performance/testing/deployment hardening
