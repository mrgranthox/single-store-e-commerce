# GitHub Actions: secrets, environments, and CI

## Workflows in this repo

| Workflow | When it runs |
|----------|----------------|
| [Backend CI](workflows/backend-ci.yml) | Push/PR to `main` or `master` when `backend/`, `deploy/`, or `docs/` change |
| [Frontend CI](workflows/frontend-ci.yml) | Push/PR when `admin-frontend/` or `customer-frontend/` change |
| [Security Gates](workflows/security-gates.yml) | All PRs and pushes to `main` / `master` (Gitleaks + dependency review on PRs) |
| [Backend Docker Publish](workflows/backend-docker.yml) | After successful **Backend CI** on `main` or `master`, or manual dispatch |
| [Backend Deploy](workflows/backend-deploy.yml) | Manual only — SSH + `.env` materialized from secrets |
| [Backend nightly](workflows/backend-nightly.yml) | Scheduled + manual |
| [Synthetic Checks](workflows/synthetic-checks.yml) | Scheduled + manual — needs `APP_BASE_URL` and optional API tokens |

**Backend CI** and **Frontend CI** do not require repository secrets for the default jobs. Integration tests use ephemeral Postgres/Redis and dummy Paystack/Turnstile values.

## Repository secrets for deploy (Backend Deploy)

Configure under **Settings → Secrets and variables → Actions** (and restrict who can run the deploy workflow).

| Secret | Purpose |
|--------|---------|
| `SSH_PRIVATE_KEY` | SSH key for the target host |
| `SSH_USER` | SSH username |
| `SSH_HOST` | Deploy host |
| `DEPLOY_PATH` | Remote directory for compose + scripts |
| `GHCR_PAT` | Token with `read:packages` to pull backend image from GHCR |
| `APP_BASE_URL` | Public API base URL (health checks, optional default for deploy) |
| `QUEUE_PREFIX` | BullMQ key prefix |
| `PAYMENT_PROVIDER` | e.g. `paystack` |
| `PAYSTACK_VERIFY_TRANSACTIONS` | `true` / `false` |
| `POSTGRES_DB` | Database name (if used by your compose stack) |
| `POSTGRES_USER` | DB user |
| `POSTGRES_PASSWORD` | DB password |
| `DATABASE_URL` | Prisma connection string |
| `REDIS_URL` | Redis URL |
| `ADMIN_APP_URL` | Admin SPA URL |
| `CUSTOMER_APP_URL` | Storefront URL |
| `MOBILE_APP_URL` | Mobile/deep-link base |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins |
| `CLERK_PUBLISHABLE_KEY` | Clerk |
| `CLERK_SECRET_KEY` | Clerk |
| `CLERK_WEBHOOK_SECRET` | Clerk webhooks |
| `SENTRY_DSN` | Optional |
| `SENTRY_ENABLED` | `true` / `false` |
| `SENTRY_ENVIRONMENT` | e.g. `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | `0`–`1` |
| `SENTRY_PROFILE_SAMPLE_RATE` | `0`–`1` |
| `SENTRY_ATTACH_STACKTRACE` | `true` / `false` |
| `SENTRY_SEND_DEFAULT_PII` | `true` / `false` |
| `SENTRY_DEBUG` | `true` / `false` |
| `PAYSTACK_SECRET_KEY` | Live secret key |
| `PAYSTACK_PUBLIC_KEY` | Public key |
| `PAYSTACK_WEBHOOK_SECRET` | Webhook signing secret |
| `EMAIL_PROVIDER` | e.g. `brevo` or `none` |
| `BREVO_SMTP_HOST` | If using Brevo SMTP |
| `BREVO_SMTP_PORT` | Port |
| `BREVO_SMTP_LOGIN` | SMTP login |
| `BREVO_SMTP_PASSWORD` | SMTP password |
| `BREVO_API_KEY` | Alternative to SMTP |
| `EMAIL_FROM` | From address |
| `EMAIL_FROM_NAME` | Display name |
| `EMAIL_REPLY_TO` | Reply-To |
| `STORAGE_PROVIDER` | `cloudinary` or `none` |
| `CLOUDINARY_CLOUD_NAME` | If using Cloudinary |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |
| `ABUSE_CHALLENGE_PROVIDER` | e.g. `none` or `turnstile` |
| `PUBLIC_SUPPORT_CAPTCHA_ENABLED` | `true` / `false` |
| `TURNSTILE_SITE_KEY` | If Turnstile enabled |
| `TURNSTILE_SECRET_KEY` | |
| `TURNSTILE_EXPECTED_HOSTNAMES` | Comma-separated hostnames |
| `SESSION_SECRET` | ≥32 characters |
| `LOG_LEVEL` | e.g. `info` |

Deploy workflow pins `ALLOW_DEV_AUTH_BYPASS=false` in the generated remote `.env`.

## Synthetic checks

| Secret | Purpose |
|--------|---------|
| `APP_BASE_URL` | Base URL passed to `deploy/scripts/synthetic-checks.sh` |
| `SYNTHETIC_ADMIN_API_TOKEN` | Optional bearer for admin probes |
| `SYNTHETIC_CUSTOMER_API_TOKEN` | Optional bearer for customer probes |

## GitHub Environments (recommended)

For production, create a **production** environment with required reviewers and move deploy-time secrets there. Reference: [Environments for deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment).

## Local `.env` (not committed)

- Backend: `backend/.env.example` → `backend/.env`; production rules in `backend/src/config/env.ts`.
- Admin: `admin-frontend/.env.example` — only `VITE_*` variables are exposed to the browser at build time.

## First push to GitHub

From the repo root (after `git init` if needed):

```bash
git add .
git status   # confirm no .env files are listed
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<org>/<repo>.git
git push -u origin main
```

Using GitHub CLI: `gh repo create <name> --private --source=. --remote=origin --push` after the first commit.
