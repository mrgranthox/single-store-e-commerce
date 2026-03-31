# Backend Codebase Review

Date: 2026-03-27

## Current implementation state

The backend is now organized around the documented commerce domains:

- auth and admin session management
- catalog, inventory, content, promotions, reviews
- carts, checkout, orders, payments, shipping, returns
- customers, support, notifications
- audit, security, alerts, incidents, reports, integrations

Operational foundations are present:

- PostgreSQL with Prisma
- Redis and BullMQ workers
- Clerk-backed auth integration
- Sentry runtime instrumentation
- Paystack payment provider
- Cloudinary media storage
- Brevo email delivery

## Integration review

### Cloudinary

- Product media, banners, and support attachments now use signed Cloudinary upload intents.
- Backend writes are not trusted blindly: the API verifies the Cloudinary asset before persisting metadata.
- Private delivery is used for support attachments.
- Cleanup is implemented for unreferenced Cloudinary product assets.

### Paystack

- Card and mobile-money initialization flows are implemented.
- Webhooks validate the raw-body HMAC signature.
- Paystack webhook source IP allowlisting is enforced.
- Webhook reconciliation verifies the transaction reference against Paystack before final state changes are accepted.
- Amount, currency, and customer-email cross-checks reduce forged or mismatched webhook risk.

### Sentry

- Sentry is initialized in both HTTP and worker runtimes.
- Request and error context is captured centrally.
- Sensitive values are sanitized before events are emitted.
- Runtime shutdown flushes Sentry buffers.

### Brevo

- Notification templates cover the current customer-facing operational events.
- Brevo SMTP is supported when relay credentials are configured.
- Brevo API fallback is supported when the environment provides an API key instead of SMTP credentials.
- If `EMAIL_FROM` is not explicitly configured, the backend can discover an active Brevo sender instead of using a placeholder sender.

## Security review

Strengths:

- provider secrets are environment-driven
- payment webhooks use signature verification and provider-side reconciliation
- log redaction covers common payment and email secrets
- Cloudinary uploads are signed and folder-scoped
- Sentry default PII sending remains disabled unless explicitly enabled

Residual risks to track:

- production should set an explicit `EMAIL_FROM`; sender auto-discovery is appropriate for development convenience, not for long-term production determinism
- Paystack mobile money success still depends on merchant-side channel enablement and provider availability
- dev auth bypass remains available by env flag and must stay disabled outside controlled local environments
- notification retries can amplify provider-side rate pressure if large bursts are introduced without queue throttling

## Recommended next implementation priorities

1. Add automated integration tests for Paystack webhook verification and Cloudinary asset finalization paths.
2. Add queue-level rate limiting and concurrency tuning per provider-facing job type.
3. Add explicit frontend upload flows that consume the new Cloudinary signed upload-intent endpoints.
4. Add notification preference management if customer communication controls are in scope.
5. Remove remaining legacy wording in generated or archival docs that still references alternate providers.
