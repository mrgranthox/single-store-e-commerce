# E-Commerce Backend Module-by-Module Cursor/Codex Build Prompts Pack

## Executive overview
This pack is designed for coding agents such as Cursor, Codex, or Claude Code. It breaks the backend into implementation modules so the system can be built in controlled slices rather than one giant ambiguous prompt.

Use these prompts sequentially or assign them to separate implementation branches. Each module prompt assumes:
- Node.js
- TypeScript
- Express
- Prisma
- PostgreSQL
- Redis
- single-store-first architecture
- future multi-store readiness
- strict auditability and security requirements

## How to use this pack
Recommended workflow:
1. implement one module at a time
2. commit after each successful module
3. run migrations and tests after each module
4. keep route contracts aligned with the API pack
5. keep database changes aligned with Prisma schema and relational spec
6. do not invent extra statuses or relations outside the spec without explicit note

## Global master prompt
Use before module prompts:

```text
You are implementing a production-grade backend for a single-store e-commerce platform with future multi-store readiness. Use Node.js, TypeScript, Express, Prisma, PostgreSQL, and Redis. Follow the existing architecture documents, Prisma schema, API contract, audit/security requirements, and frontend screen contracts. Do not invent alternative data models unless clearly necessary and documented. Preserve strong validation, typed DTOs, centralized errors, RBAC, audit logs, and idempotent payment-safe operations.
```

## Prompt 1: backend foundation and app shell
```text
Implement the backend application foundation for the e-commerce platform. Create the Express app shell, config system, environment validation, shared error model, request validation layer, auth middleware placeholders, RBAC middleware placeholders, centralized logger, health endpoint, readiness endpoint, and modular route registration. Establish a feature-based backend folder structure with controllers, services, repositories, validators, dto types, and background jobs folders. Add OpenAPI-friendly route metadata scaffolding and a consistent success/error response envelope.
```

Expected output:
- app bootstrap
- config module
- health routes
- shared middleware
- error utilities
- logger setup
- route composition strategy

## Prompt 2: Prisma integration and migrations setup
```text
Set up Prisma integration for the e-commerce backend. Wire DATABASE_URL config, client singleton, migration scripts, seed scaffolding, transaction helper utilities, and repository base patterns. Do not redesign the schema. Use the existing Prisma schema as source of truth and prepare migration-safe utilities for module development.
```

Expected output:
- prisma client setup
- script commands
- seed entry
- transaction helpers

## Prompt 3: auth and account module
```text
Implement auth and account modules. Support register, login, logout, forgot password, reset password, email verification, account profile read/update, address CRUD, preferences read/update, and session listing/revocation. Use secure hashing, token/session handling, validation, and consistent auth guards. Emit audit-friendly account activity events.
```

Expected output:
- auth routes/services
- account routes/services
- password reset flow
- session handling
- validation schemas
- tests for core auth paths

## Prompt 4: roles, permissions, and RBAC
```text
Implement RBAC using roles, permissions, role_permissions, and user_roles. Add middleware to protect admin routes by permission code, not just by role name. Support admin permission hydration on /admin/me and a seed strategy for default roles and permissions. Sensitive admin actions must expose hooks for audit logging.
```

Expected output:
- RBAC middleware
- permission resolver
- role/permission seeds
- admin permission checks

## Prompt 5: catalog module
```text
Implement the catalog module: products, categories, brands, product variants, product images, product attributes, public catalog listing, product detail, search, and admin catalog CRUD. Support publish/unpublish/archive actions, product analytics placeholder endpoints, and activity/timeline hooks. Keep the service layer modular and validation strict.
```

Expected output:
- public catalog endpoints
- admin catalog endpoints
- product/variant/media services
- category and brand services
- publish/archive actions
- tests for product create/update/list/detail

## Prompt 6: inventory and warehouses module
```text
Implement warehouses, inventory_items, inventory_movements, low-stock queries, out-of-stock queries, warehouse detail, inventory overview, and stock adjustment flows. Every stock mutation must create an inventory_movement record. Manual adjustments must also emit admin action log hooks. Build service logic around transactional stock changes.
```

Expected output:
- inventory endpoints
- warehouse CRUD basics
- adjustment service
- movement history queries
- low-stock/out-of-stock queries

## Prompt 7: cart module
```text
Implement cart and cart_items with support for guest carts and authenticated carts. Support item add, update, remove, coupon application placeholder integration, totals recomputation, and cart merge behavior after login. Keep product availability and pricing revalidation backend-driven.
```

Expected output:
- cart service and routes
- cart merge behavior
- totals calculation
- coupon placeholder contract

## Prompt 8: checkout and order creation
```text
Implement checkout validation and order creation. Validate cart integrity, stock, pricing, coupon impact, shipping method, and account/guest eligibility. Snapshot order items and addresses. Create pending payment records safely and support idempotency keys so duplicate checkout submissions do not create duplicate orders.
```

Expected output:
- checkout validate endpoint
- create-order endpoint
- snapshot services
- idempotency handling
- tests for duplicate submission safety

## Prompt 9: payments and provider abstraction
```text
Implement a provider-agnostic payments module with a PaymentService interface and a first concrete provider integration scaffold. Support payment initialization, webhook verification, payment status updates, payment transactions recording, failed payment handling, and replay-safe webhook processing. Do not mark payments as paid based only on frontend callbacks.
```

Expected output:
- payment provider interface
- initialize-payment endpoint
- webhook handler
- payment transaction recorder
- idempotent verification logic

## Prompt 10: orders, order timeline, and fulfillment
```text
Implement orders module features for both customer and admin use. Support order list/detail, order timeline/history, status changes, internal notes, admin order actions, and fulfillment queue queries. Build shipment creation and shipment tracking event support. Keep order_status, payment_status, and fulfillment_status separate.
```

Expected output:
- customer order endpoints
- admin order endpoints
- status history writes
- order notes
- fulfillment queue
- shipment services

## Prompt 11: returns, cancellations, and refunds
```text
Implement cancellation requests, returns, return items, refund requests, refund approvals, and refund status changes. Use backend eligibility rules from order state, payment state, and policy windows. Ensure admin approvals are audited and refund operations connect cleanly to payments and returns.
```

Expected output:
- customer return/cancel/refund request endpoints
- admin approval/rejection endpoints
- eligibility evaluator
- refund service hooks to payment transactions

## Prompt 12: reviews module
```text
Implement reviews module with customer review creation/editing and admin moderation. Enforce backend-driven eligibility rules for who can review and when. Support review status transitions such as pending, published, rejected, and hidden. Provide public review listing and customer review center endpoints.
```

Expected output:
- review creation/edit endpoints
- moderation endpoints
- eligibility check endpoint
- review listing endpoints

## Prompt 13: support module
```text
Implement support tickets, support messages, support attachments, support status history, customer support endpoints, and admin support operations. Support order-linked tickets, internal notes, assignment, queue views, and SLA-oriented filters. Keep customer-visible messages separate from internal notes.
```

Expected output:
- ticket CRUD-like flows
- message/reply flows
- assignment/status changes
- queue filters
- attachment handling contract

## Prompt 14: content and marketing module
```text
Implement CMS pages, banners, coupons, promotions, promotion_rules, and coupon redemption analytics endpoints. Support admin management and public content consumption. Promotions and coupons should expose clean validation points for checkout integration without hard-coding business logic into controllers.
```

Expected output:
- CMS content endpoints
- banner endpoints
- coupon/promotion endpoints
- analytics placeholder queries

## Prompt 15: customer intelligence module
```text
Implement admin customer intelligence endpoints. Support customer detail overview, activity timeline aggregation, order history, support history, review history, risk summary, and account status actions such as suspend/restore. Keep aggregation service separate from raw repositories.
```

Expected output:
- customer detail aggregator
- customer activity feed
- suspend/restore actions
- linked history endpoints

## Prompt 16: notifications module
```text
Implement notifications and notification_events with support for order emails, password reset emails, support updates, and marketing-ready templates later. Use queue-friendly delivery services and keep provider integrations abstracted. Record delivery events for observability.
```

Expected output:
- notification models usage
- queued send scaffolding
- provider abstraction
- delivery event logging

## Prompt 17: audit and admin action logs
```text
Implement audit_logs, admin_action_logs, and entity_activity_logs writing helpers. Create reusable service utilities so modules can emit audit events consistently. Support actor metadata, IP/user-agent capture, entity references, before/after payloads for admin actions, and timeline-friendly event formatting.
```

Expected output:
- audit writer utility
- admin action logger
- entity activity emitter
- middleware hooks for metadata capture

## Prompt 18: security events, alerts, and incidents
```text
Implement security_events, alerts, incidents, incident_links, and risk_signals modules. Support alert listing, acknowledge/assign/resolve actions, security event listing/detail, incident creation and status changes, and risk signal retrieval. Keep these modules usable by dashboards and investigation pages.
```

Expected output:
- security module routes/services
- alert lifecycle actions
- incident workspace endpoints
- risk signal queries

## Prompt 19: jobs and webhook observability
```text
Implement webhook_events and job_runs tracking utilities. Every inbound provider webhook should be recorded with signature verification state and processing status. Every background job should be trackable with status, attempts, linked entity reference, and error detail. Expose admin monitoring endpoints for webhooks and jobs.
```

Expected output:
- webhook recorder
- job run recorder
- admin monitoring endpoints
- retry-safe processing helpers

## Prompt 20: reporting module
```text
Implement report endpoints for sales, product performance, inventory, customers, support, returns/refunds, and marketing. Keep these as aggregation/query services, not controller-heavy logic. Use pagination or time-bucket responses where appropriate and maintain consistency with dashboard widgets and report screens.
```

Expected output:
- reporting query services
- dashboard data endpoints
- time-series summaries
- export-ready response shapes later

## Prompt 21: system settings and integrations health
```text
Implement settings retrieval/update endpoints with scope support, admin permission checks, and audit logging. Also implement integration/system health endpoints for external providers, queue health, webhook pipeline health, and background processing summaries for admin system monitoring screens.
```

Expected output:
- settings service
- settings endpoints
- integration health endpoints
- audit logging for setting changes

## Prompt 22: caching, rate limiting, and performance safeguards
```text
Add Redis-backed caching strategy for public catalog, dashboard summaries where appropriate, and rate limiting for auth, support creation, and other abuse-sensitive endpoints. Do not cache sensitive personalized responses unsafely. Document invalidation strategy near relevant services.
```

Expected output:
- cache utility layer
- route-specific rate limiting
- invalidation hooks
- performance notes

## Prompt 23: test strategy and fixtures
```text
Add backend test scaffolding covering auth, RBAC, product creation, inventory adjustments, checkout, payments webhook verification, order lifecycle transitions, support message flows, and audit/security writes. Use factories or fixtures that match the real schema and keep tests modular by feature.
```

Expected output:
- test utilities
- feature integration tests
- fixtures/factories
- seed-safe test data strategy

## Prompt 24: OpenAPI and implementation QA
```text
Document the implemented backend routes in an OpenAPI-friendly structure and add QA checks for route registration completeness, permission coverage, input validation coverage, and error code consistency. Produce a final implementation checklist showing which modules are complete, partial, or placeholder.
```

Expected output:
- OpenAPI scaffold or generated spec hooks
- implementation checklist
- route/permission audit helpers

## Agent operating rules
Every coding agent executing these prompts should obey:
- do not silently redesign the schema
- do not merge unrelated modules in one giant patch
- preserve strict typing
- keep controllers thin
- keep service logic testable
- use transactions where money, stock, or state transitions matter
- log and audit sensitive actions
- return stable machine-readable error codes
- keep customer eligibility decisions backend-driven

## Suggested branch strategy
Recommended branches:
- `backend/foundation`
- `backend/auth-rbac`
- `backend/catalog`
- `backend/inventory`
- `backend/cart-checkout`
- `backend/payments-orders`
- `backend/returns-refunds`
- `backend/support-reviews`
- `backend/security-observability`
- `backend/reports-settings`

## Final position
This build prompt pack is meant to reduce ambiguity for AI-assisted backend implementation. Use it alongside the backend implementation pack, database specs, Prisma schema, API contract pack, and frontend screen documents so all layers stay aligned.
