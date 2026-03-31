# Backend Vendor Integrations Review

Date: 2026-03-27

## Scope completed

This backend now targets the currently selected production/development providers:

- Cloudinary for media storage and delivery
- Paystack for payments
- Brevo SMTP with Nodemailer for transactional email
- Sentry for backend and worker error monitoring

These changes were implemented inside the existing modular monolith rather than as isolated stubs, so catalog, content, checkout, payments, shipping, support, returns, notifications, health, and integrations all reflect the new stack.

## Cloudinary integration

### What changed

- Added signed-upload intent generation for:
  - catalog product media
  - content/banner media
  - support attachments
- Added Cloudinary asset verification before backend records are created.
- Added provider-aware media metadata storage for:
  - `product_media`
  - `banners`
  - `support_attachments`
- Added private signed delivery URLs for support attachments.
- Added Cloudinary cleanup for unreferenced product media deletions.

### Security posture

- Uploads are signed server-side.
- Allowed formats and max sizes are enforced before signing and again during asset verification.
- Support attachments use private delivery rather than permanent public URLs.
- Asset scope is validated by folder prefix so a client cannot reuse an arbitrary Cloudinary asset ID from another domain.

## Paystack integration

### What changed

- Replaced scaffold initialization with live Paystack API calls.
- Added support for:
  - cards
  - mobile money
- Added Paystack transaction verification during webhook processing.
- Added channel allowlists and mobile money provider allowlists.
- Normalized AirtelTigo aliases to Paystack's current `tgo` provider code.
- Added webhook IP allowlisting and signature verification.
- Added customer-facing payment lifecycle emails:
  - payment action required
  - order confirmed
  - payment failed

### Security posture

- Webhooks require both signature validation and source-IP validation.
- Successful webhook processing cross-checks provider amount, currency, and customer email before mutating internal payment state.
- Payment state transitions remain backend-owned.
- Queue-backed webhook processing remains durable and idempotent.

## Brevo and email delivery

### What changed

- Replaced the development-only email logger with a real SMTP transport via Nodemailer.
- Added Brevo API fallback support for environments that supply an API key instead of relay credentials.
- Added detection for SMTP keys that were misfiled as API keys, so failures now point directly to the missing SMTP login requirement.
- Added HTML and text transactional templates for:
  - welcome and auth lifecycle emails
  - payment action required
  - order confirmed
  - order status updated
  - order cancelled
  - payment failed
  - shipment update
  - shipment delivered
  - support ticket created
  - support reply
  - support ticket status updated
  - return requested
  - return approved
  - return received
  - return completed
  - return rejected
  - refund approved
  - refund rejected
  - customer suspended
  - customer restored
  - low stock alerts
  - generic admin-triggered operational/security notifications

### Security posture

- SMTP transport requires TLS.
- File and remote URL access are disabled in Nodemailer payload processing.
- Notification sends include queue-level persistence and delivery records.

## Sentry integration

### What changed

- Added early bootstrap initialization for both API and worker runtimes.
- Added Express integration, Prisma integration, request-data capture, linked-error capture, and Zod error integration.
- Added sanitized exception capture with request and actor tags.
- Added process-level `unhandledRejection` and `uncaughtException` capture.
- Added graceful Sentry flush on shutdown.

### Security posture

- Sentry events are sanitized before send.
- Secret-bearing keys such as tokens, signatures, passwords, and API keys are redacted.
- Request logging redaction was expanded to cover Paystack signatures and SMTP secrets.

## Codebase review

### Strengths

- Business rules remain backend-driven.
- Payment and webhook processing remain queue-backed and append-friendly.
- Auth, RBAC, audit, alerts, and observability continue to be backend-owned.
- Provider wiring is abstracted behind shared config or provider modules instead of being spread across controllers.

### Residual risks and follow-up

- The repo still carries Prisma’s `package.json#prisma` deprecation warning. Move to `prisma.config.ts`.
- Support attachments now use signed private delivery URLs, but there is not yet a dedicated audit trail for attachment downloads.
- The mailer currently uses direct HTML string rendering. A stricter template build/test pipeline can be added later if the notification surface keeps expanding.
- Frontend clients still need to consume the new signed-upload intent routes and Paystack initialization payloads.

## Operational checklist

Before production validation:

- confirm Cloudinary folders and quotas
- confirm Paystack live/test keys and webhook endpoint registration
- confirm Brevo sender identity and reply-to mailbox
- confirm Sentry environment naming and alert rules
- run Prisma migration against the target database
- test:
  - card payment
  - mobile money payment
  - webhook replay
  - support attachment upload/download
  - shipment and support notification delivery
