# Production Readiness Matrix

This repo targets a single-store e-commerce system with browser/mobile clients, an Express API, Postgres, Redis/BullMQ workers, object storage, and external identity/payment providers.

| Area | Current control |
| --- | --- |
| Frontend foundation | Admin and customer apps are Vite/React SPAs with typed builds, route catalogs, Netlify SPA redirects, Sentry-capable error boundaries, security headers, and immutable hashed asset caching. Mobile integration files define backend configuration contracts. |
| APIs and backend logic | Express 5 backend uses route modules, typed request validation, consistent success/error envelopes, request IDs, Helmet, CORS allow-listing, body-size limits, and a default no-store API cache policy. |
| Database and storage | Prisma/Postgres schema and migrations are versioned. Cloudinary is the configured media storage provider, with production env validation for required credentials and signed-upload defaults. Redis backs queues, worker heartbeats, and rate-limit counters. |
| Auth and permissions | Clerk-backed identity is mapped into backend customer/admin actors. Admin access is permission-code based through RBAC middleware and verified by `verify-rbac-contracts`; sensitive admin actions use step-up controls. |
| Hosting and deployments | Backend can run through Docker Compose/GHCR, Render, or equivalent Node hosts. The deploy workflow verifies migration safety, uploads a compose release bundle, runs one-shot migrations, health-checks, and can roll back. |
| Cloud and compute | API and worker run as separate processes/containers. The runtime image uses `dumb-init` and a non-root user. Redis/BullMQ handles asynchronous jobs and operational schedules. |
| CI/CD and version control | GitHub Actions cover backend unit/integration/build gates, frontend quality/build gates, dependency review, secret scanning, Docker publish, deploy, nightly integration drift checks, and synthetic checks. Dependabot tracks npm and GitHub Actions updates. |
| Security and RLS | App-layer authorization is enforced in the API; database access is not exposed directly to browsers or mobile clients. Postgres RLS stance: RLS is not enabled in the current Prisma service-role architecture because all traffic goes through the trusted API. If direct database access, Supabase client access, or hard tenant isolation is introduced, add RLS migrations and per-request DB session variables before exposing data paths. |
| Rate limiting | Redis-backed rate limiting is applied to auth, webhooks, checkout, public search, admin invitation/session, notification, and other high-risk paths. Critical auth/payment limits fail closed in production. |
| Caching and CDN | Backend API responses default to no-store. Netlify frontends send no-cache headers for SPA documents, immutable long-lived headers for hashed assets, and CSP/clickjacking/referrer/content-type/permissions headers. |
| Load balancing and scaling | The production Compose file separates migration from API replicas so replicas do not race. `/ready` checks DB, Redis, migrations, and worker heartbeat. The runbook documents multi-replica and Kubernetes/non-Compose migration patterns. |
| Error tracking and logs | Backend and admin/customer frontends have Sentry integration hooks. Backend logs are structured with request/trace IDs and redaction for secrets and personal data. |
| Availability and recovery | `/health`, `/ready`, worker heartbeats, synthetic checks, rollback scripts, migration-safety checks, Postgres backup script, and a quarterly restore drill are documented in `deploy/RUNBOOK.md`. |

Run `cd backend && npm run verify:enterprise` before release; it includes the operational readiness gate that checks these controls remain present.
