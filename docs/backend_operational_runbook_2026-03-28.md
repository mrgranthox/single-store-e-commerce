# Backend Operational Runbook

Date: 2026-03-28

## Purpose
- Define the baseline operational checks, recovery paths, and verification commands for the e-commerce backend.
- Capture the current hardening posture after the HTTPS integration suite, load-smoke validation, and legacy replay improvements.

## Baseline verification commands
- Build:
  - `cd backend && npm run build -- --pretty false`
- Unit plus HTTPS integration suite:
  - `cd backend && npm test`
- Load smoke:
  - `cd backend && LOAD_SMOKE_BASE_URL=http://127.0.0.1:4114 LOAD_SMOKE_CONCURRENCY=12 LOAD_SMOKE_ITERATIONS=8 npm run test:load:smoke`
- Soak smoke:
  - `cd backend && SOAK_BASE_URL=http://127.0.0.1:4116 SOAK_DURATION_MS=30000 SOAK_STAGE_DURATION_MS=10000 SOAK_CONCURRENCY_START=8 SOAK_CONCURRENCY_STEP=4 npm run test:soak:smoke`
- Fault injection:
  - `cd backend && npm run test:fault:injection`

## Observability assertions
- `GET /health` must return `200`.
- `GET /ready` must return `200`.
- Every HTTP response must emit `x-request-id`.
- Invalid webhook signatures must create:
  - a `security_events` row with `type=INVALID_WEBHOOK_SIGNATURE`
  - an `alerts` row tied to the security event
- Valid payment webhooks must:
  - persist a `webhook_events` row
  - queue a webhook job
  - transition the payment and order when processed
- Sentry should remain enabled in environments where `SENTRY_ENABLED=true` and `SENTRY_DSN` is configured.

## HTTPS integration coverage now in place
- Customer auth lifecycle:
  - register
  - resend verification
  - verify email
  - login
  - session lookup
  - refresh
  - forgot-password
  - reset-password
  - logout
- Public abuse-protected support intake:
  - support config fetch
  - Turnstile-backed contact submit
- Checkout and payments:
  - add cart item
  - validate checkout
  - create order
  - initialize payment
  - invalid webhook path
  - valid webhook path
  - webhook job processing
- Post-purchase and governance:
  - create return request
  - RBAC denial for admin approval without permissions
  - approve return
  - approve refund
  - mark refund completed
  - manual replay override for an unknown legacy job

## Load-smoke baseline
- Latest validation:
  - requests: `96`
  - failures: `0`
  - average latency: `202.61ms`
  - p95 latency: `596.53ms`
- Current smoke target set:
  - `/health`
  - `/api/products`
  - `/api/support/public-config`

## Soak-smoke baseline
- Latest validation:
  - requests: `2756`
  - failures: `0`
  - average latency: `87.87ms`
  - p95 latency: `151.07ms`
  - p99 latency: `202.72ms`
- Stage progression:
  - stage 1: concurrency `8`, requests `776`, failures `0`
  - stage 2: concurrency `12`, requests `924`, failures `0`
  - stage 3: concurrency `16`, requests `1056`, failures `0`

## Fault-injection baseline
- Latest validation:
  - Postgres outage simulation returned the expected Prisma connectivity failure.
  - Redis outage simulation returned the expected connection-closed failure.
  - Paystack outage simulation returned the expected fetch/network failure.
  - Brevo outage simulation returned the expected SMTP connection-refused failure.

## Payment webhook recovery
- Use automatic replay when the `job_runs.metadata.retry` block exists.
- For historical job runs without retry metadata, use:
  - `POST /api/admin/jobs/:jobRunId/retry`
- For arbitrary unknown legacy jobs, provide the manual override body:
  - `queueName`
  - `jobName`
  - `payload`
- For webhook rows specifically, use:
  - `POST /api/admin/webhooks/:webhookEventId/retry`

## Notification and queue recovery
- Inspect:
  - `/api/admin/jobs`
  - `/api/admin/webhooks`
  - `/api/admin/notifications`
- Retry queue-backed failures from the admin retry endpoints before performing manual DB intervention.
- Preserve job and alert history; do not delete failed rows as a first response action.

## CAPTCHA and abuse-protection rollout
- Backend enforcement is controlled by:
  - `PUBLIC_SUPPORT_CAPTCHA_ENABLED`
  - `ABUSE_CHALLENGE_PROVIDER`
  - `TURNSTILE_SITE_KEY`
  - `TURNSTILE_SECRET_KEY`
  - `TURNSTILE_EXPECTED_HOSTNAMES`
- Public clients should read:
  - `GET /api/support/public-config`
  - `GET /api/mobile/support/config`
- If Turnstile is degraded:
  - set `PUBLIC_SUPPORT_CAPTCHA_ENABLED=false` only as an explicit incident mitigation
  - monitor support spam volume and restore verification as soon as provider health returns

## Incident handling guidance
- Payment incident:
  - confirm webhook receipt
  - confirm queueing
  - inspect `payment_transactions`
  - replay the webhook job if safe
  - escalate only after provider reference verification fails
- Notification incident:
  - inspect `notifications` state and provider ids
  - inspect queued delivery jobs
  - replay notification jobs before attempting provider-side resend by hand
- Support abuse spike:
  - verify Turnstile enforcement is active
  - inspect rate-limits and spam patterns by IP and email
  - tighten abuse policy before disabling public intake

## Remaining operational depth still worth adding
- Sustained soak and concurrency testing beyond the current smoke load.
- Fault-injection drills for Redis, Postgres, email-provider, and payment-provider degradation.
- Alert-threshold tuning and dashboarding around webhook backlog, queue latency, and email failures.
- Scheduled recovery drills using the retry and replay endpoints.
