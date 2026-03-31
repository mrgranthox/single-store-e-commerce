# Backend Gap Review

Date: 2026-03-28

## Scope reviewed
- `docs/ecommerce_backend_api_implementation_contract_pack.md`
- `docs/ecommerce_customer_api_contract_50screens.md`
- `docs/ecommerce_mobile_api_contract_48screens.md`
- `docs/ecommerce_admin_api_contract_72screens.md`

## Completed in this pass
- Added public customer auth endpoints for:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
  - `POST /api/auth/verify-email`
  - `POST /api/auth/resend-verification`
  - `POST /api/auth/verify-email/resend`
  - `POST /api/auth/verify-email/confirm`
  - `GET /api/auth/session`
  - `POST /api/auth/logout`
- Added mobile auth endpoints for:
  - `POST /api/mobile/auth/register`
  - `POST /api/mobile/auth/login`
  - `POST /api/mobile/auth/refresh`
  - `POST /api/mobile/auth/forgot-password`
  - `POST /api/mobile/auth/reset-password`
  - `POST /api/mobile/auth/verify-email`
  - `POST /api/mobile/auth/resend-verification`
  - `GET /api/mobile/auth/session`
  - `POST /api/mobile/auth/logout`
- Added admin auth endpoints for:
  - `POST /api/admin/auth/login`
  - `POST /api/admin/auth/refresh`
  - `POST /api/admin/auth/forgot-password`
  - `POST /api/admin/auth/reset-password`
  - `POST /api/admin/auth/logout`
  - `GET /api/admin/auth/me`
  - `GET /api/admin/auth/sessions`
  - `POST /api/admin/auth/sessions/revoke-all`
  - `POST /api/admin/auth/sessions/:sessionId/revoke`
- Added backend-owned opaque access and refresh token sessions for customer and mobile API clients.
- Added persisted verification and password-reset challenge storage.
- Added backend-owned opaque access and refresh token sessions for admin API clients.
- Added persisted admin password-reset challenge storage.
- Extended auth middleware to authenticate backend bearer tokens for both customer/mobile and admin API clients in addition to Clerk-backed request auth.
- Linked account session revocation and password change flows to backend API-session revocation.
- Linked admin session revoke and logout flows to backend API-session revocation.
- Added provider-compatible optional `phoneNumber` support for registration and translated common Clerk validation failures to `INVALID_INPUT`.

## Runtime verification completed
- `npx prisma generate`
- `npx prisma migrate dev --name customer_api_auth_foundation`
- `npx tsc -p tsconfig.json --noEmit --pretty false`
- `npm run build -- --pretty false`
- Live smoke on real services:
  - `POST /api/auth/register`
  - `POST /api/mobile/auth/resend-verification`
  - `POST /api/auth/verify-email/confirm`
  - `POST /api/mobile/auth/login`
  - `GET /api/mobile/auth/session`
  - `POST /api/mobile/auth/refresh`
  - `POST /api/auth/forgot-password`
  - `POST /api/mobile/auth/reset-password`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
- Live smoke on a temporary seeded admin:
  - `POST /api/admin/auth/login`
  - `GET /api/admin/auth/me`
  - `GET /api/admin/auth/sessions`
  - `POST /api/admin/auth/refresh`
  - `POST /api/admin/auth/sessions/:sessionId/revoke`
  - `POST /api/admin/auth/forgot-password`
  - `POST /api/admin/auth/reset-password`
  - `POST /api/admin/auth/sessions/revoke-all`
  - `POST /api/admin/auth/logout`
- Negative-path smoke:
  - `POST /api/auth/register` with an unsupported phone-country code now returns `400 INVALID_INPUT`
 - Later contract smoke:
  - `GET /health`
  - `GET /api/admin/jobs`
  - `GET /api/admin/settings/checkout`
  - `GET /api/admin/coupons`
  - `GET /api/admin/security-events`
  - all of the new admin-contract routes above mounted successfully and returned `401 AUTH_REQUIRED` when called unauthenticated

## Additional closure in the latest pass
- Closed the remaining admin fulfillment contract gaps:
  - `POST /api/admin/orders/:orderId/assign-warehouse`
  - `PATCH /api/admin/shipments/:shipmentId`
- Closed the remaining admin marketing contract gaps:
  - plain `/api/admin/coupons/*`
  - plain `/api/admin/promotions/*`
  - plain `/api/admin/promotions/:promotionId/rules*`
  - `GET /api/admin/campaigns/performance`
- Closed the remaining admin reporting contract gaps:
  - `GET /api/admin/reports/overview`
  - `GET /api/admin/reports/inventory`
  - `GET /api/admin/reports/refunds-returns`
  - `GET /api/admin/reports/marketing`
- Closed the remaining admin governance and security contract gaps:
  - `GET /api/admin/audit-logs`
  - `GET /api/admin/admin-action-logs`
  - `GET /api/admin/user-activity`
  - `POST /api/admin/alerts/:alertId/acknowledge`
  - `POST /api/admin/incidents/:incidentId/close`
  - plain `/api/admin/security-events*`
  - plain `/api/admin/risk-signals`
- Closed the remaining admin system/operations contract gaps:
  - plain `/api/admin/settings`
  - plain `/api/admin/settings/checkout`
  - plain `/api/admin/jobs*`
  - plain `/api/admin/webhooks*`
  - `POST /api/admin/jobs/:jobRunId/retry`
  - `POST /api/admin/webhooks/:webhookEventId/retry`
  - `GET /api/admin/integrations/exceptions`
  - `POST /api/admin/finance/exceptions/:exceptionId/resolve`
- Closed the remaining customer/admin account contract aliases:
  - `POST /api/admin/customers/:customerId/reactivate`
  - `POST /api/admin/customers/:customerId/internal-actions`
- Added provider-backed abuse challenge enforcement for public support and product inquiry flows:
  - optional Cloudflare Turnstile verification for contact form submit
  - optional Cloudflare Turnstile verification for inquiry submit
  - optional Cloudflare Turnstile verification for guest upload-intent creation
- Backfilled retry support for older historical job runs that predate explicit retry metadata when they match known legacy queue/job-id shapes:
  - payment webhook processing jobs
  - notification delivery jobs
  - diagnostic ping reconciliation jobs
- Broadened automated verification with targeted tests for:
  - Turnstile response evaluation
  - legacy job replay inference
  - storefront compatibility helpers
- Added a real HTTPS integration suite for:
  - auth lifecycle
  - abuse-protected public support intake
  - checkout create-order and initialize-payment
  - payment webhook ingestion and job processing
  - returns/refunds transitions
  - RBAC denial and approval paths
  - notification-trigger assertions
  - unknown legacy job replay via manual override
- Split automated validation into:
  - `npm run test:unit`
  - `npm run test:integration`
  - `npm test`
- Added HTTPS test-server fixtures and request helpers so integration coverage runs over TLS, not plain in-process calls.
- Extended legacy replay recovery so arbitrary unknown historical job runs can still be replayed manually when an operator supplies:
  - `queueName`
  - `jobName`
  - `payload`
- Added operational hardening artifacts:
  - load-smoke runner
  - observability assertions in the HTTPS integration suite
  - backend runbook documentation

## Runtime verification completed in the quality-depth pass
- `npx tsc -p tsconfig.json --noEmit --pretty false`
- `npm run build -- --pretty false`
- `npm test`
- `LOAD_SMOKE_BASE_URL=http://127.0.0.1:4114 LOAD_SMOKE_CONCURRENCY=12 LOAD_SMOKE_ITERATIONS=8 npm run test:load:smoke`
  - `96` requests
  - `0` failures
  - average `202.61ms`
  - p95 `596.53ms`

## Additional closure in the latest deployment and hardening pass
- Added public runtime-config endpoints for frontend and mobile clients:
  - `GET /api/client-config/customer`
  - `GET /api/client-config/mobile`
  - `GET /api/client-config/admin`
- Added frontend/mobile/backend integration helpers for:
  - customer support challenge-token submission
  - mobile support challenge-token submission
  - admin runtime-config bootstrap and report/media path access
- Added broader HTTPS integration coverage for:
  - inventory permission denial, warehouse create/update, stock adjustment, overview, low-stock, movement history
  - admin catalog create/update/publish/media flows
  - content page create/publish/public fetch
  - content banner create/publish/public fetch
  - shipment create/update/tracking progression
  - report overview, inventory, marketing, product, and post-purchase endpoints
- Added longer-running soak tooling and verified it against a live temporary server:
  - `SOAK_BASE_URL=http://127.0.0.1:4116 SOAK_DURATION_MS=30000 SOAK_STAGE_DURATION_MS=10000 SOAK_CONCURRENCY_START=8 SOAK_CONCURRENCY_STEP=4 npm run test:soak:smoke`
  - `2756` requests
  - `0` failures
  - average `87.87ms`
  - p95 `151.07ms`
  - p99 `202.72ms`
- Added provider/dependency fault-injection tooling and verified expected failure signatures for:
  - Postgres
  - Redis
  - Paystack
  - Brevo
- Expanded automatic legacy replay inference with additional metadata- and name-based recovery hints for:
  - webhook processing
  - notification delivery
  - diagnostic ping jobs
- Added explicit retry job recording for replayed admin notifications.
- Added Docker deployment assets for:
  - local API + worker + Postgres + Redis orchestration
  - GHCR-backed remote deployment
- Added GitHub Actions workflows for:
  - CI
  - Docker publish to GHCR
  - remote deploy over SSH
- Added route-catalog export support and generated:
  - `docs/backend_route_catalog_2026-03-28.json`

## Remaining gaps after the latest review

### 1. Historical retry backfill is stronger, but auto-inference is still limited to recognizable legacy shapes
- Automatic replay inference now covers the known legacy webhook, notification, and diagnostic job families plus metadata hints.
- Unknown historical jobs remain replayable through the manual override body, but they are not auto-reconstructed unless a new legacy-shape mapper is added for them.

### 2. Turnstile rollout is backend-ready and client scaffolds exist, but production enforcement still depends on the real frontend/mobile apps consuming them
- Backend runtime-config endpoints now expose the challenge contract.
- Customer and mobile integration helper modules now submit `captchaToken`.
- Full production readiness still depends on the actual frontend/mobile applications wiring those helpers into their UI challenge widgets.

### 3. Operational hardening is now materially deeper, but dashboard and incident-threshold tuning is still operational work
- Automated load smoke, soak smoke, fault injection, HTTPS integration tests, and written runbooks are now in place.
- Remaining work is mostly live-environment tuning:
  - Sentry/dashboard alert thresholds
  - backlog and latency SLO thresholds
  - longer real-environment concurrency drills
  - recurring recovery drills in staging/production

### 4. Automated verification is broad and meaningful, but still not exhaustive across every low-value edge case
- Current automated validation is:
  - compile
  - helper/unit tests
  - HTTPS integration tests
  - load smoke
- Still under-covered relative to total scope:
  - report/export consistency checks
  - long-tail notification-provider behavior under failure
  - deeper queue recovery scenarios across every job family

## Deployment and provider constraints identified during review
- The current Clerk instance requires `phone_number` for registration.
- The current Clerk instance also rejects some phone-country codes, including the Ghana test number used during local verification.
- The backend now accepts optional E.164 `phoneNumber` on registration and translates these provider-side validation failures to customer-facing `INVALID_INPUT` errors.
- This is a deployment-configuration constraint, not a missing backend auth implementation.

## Current backend state
- Public customer auth is now implemented end to end.
- Mobile auth is now implemented end to end.
- Admin auth is now implemented end to end.
- Account security session revocation now invalidates backend API tokens as well as session metadata.
- Provider-backed CAPTCHA is implemented on the backend for public support/inquiry surfaces.
- Historical retry support is implemented for the known legacy job families that matter operationally, and manual replay overrides now cover arbitrary unknown legacy jobs.
- The documented admin/customer/mobile/backend contract surface is now materially implemented.
- HTTPS integration coverage now exists for the highest-value auth, checkout, payment, returns, RBAC, and notification-trigger paths.
- HTTPS integration coverage now also exists for inventory, shipping, admin catalog/content mutations, and core reports.
- The highest-value remaining backend work is now operational depth rather than missing core modules:
  1. broader integration coverage for the remaining low-priority admin and operations edge cases
  2. full client-side CAPTCHA rollout and abuse-policy hardening
  3. sustained resilience, soak, and fault-injection verification
