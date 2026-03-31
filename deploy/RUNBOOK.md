# Production operations runbook (backend)

## Architecture (reference)

- **API**: `dumb-init` + `node dist/src/bootstrap/server.js` as a **non-root** `nodejs` user (see `backend/Dockerfile`).
- **Worker**: same image; Compose overrides the command to run the worker entrypoint (still under `dumb-init`).
- **Postgres**: primary data store; **Redis**: queues and ephemeral coordination.
- **Migrations**: one-off `migrate` service in `docker-compose.ghcr.yml` runs `npx prisma migrate deploy` before API/worker start so **multiple API replicas do not race** on migrations.
- **Health**: the API container healthcheck calls **`/ready`** (DB + Redis), not only `/health`.

Requires **Docker Compose v2** with support for `depends_on: condition: service_completed_successfully` (Compose specification 3.9+).

## Environment

- Validate locally: `NODE_ENV=production` with your intended `.env` and `tsx -e "import './src/config/env'"` from `backend/` (or start the server once and confirm no boot error).
- Production enforces: **non-localhost** `APP_BASE_URL`, `ADMIN_APP_URL`, `CUSTOMER_APP_URL`, `MOBILE_APP_URL`; **CORS** must not match the default local-dev triple origin list; **Postgres/Redis URLs** must not use `localhost` / loopback (use Compose service names like `postgres`, `redis`, or managed hostnames); Paystack + Clerk secrets; Brevo when `EMAIL_PROVIDER=brevo`; Cloudinary when `STORAGE_PROVIDER=cloudinary`; Sentry DSN when `SENTRY_ENABLED=true`; Turnstile keys when public support captcha + Turnstile is enabled; **real** `EMAIL_FROM` (not `example.com`) when using Brevo.
- Unset GitHub Actions secrets render as empty lines in `.env`; the backend **drops empty optional keys** so schema defaults apply (avoid broken `KEY=` lines).
- To explicitly disable email or object storage at **config validation** time: `EMAIL_PROVIDER=none` or `STORAGE_PROVIDER=none` (features that need them will fail at runtime).
- **GitHub deploy workflow** (`.github/workflows/backend-deploy.yml`) writes `NODE_ENV=production` and forwards optional keys such as `QUEUE_PREFIX`, `PAYSTACK_VERIFY_TRANSACTIONS`, Sentry tuning, and `TURNSTILE_EXPECTED_HOSTNAMES`. Define matching repository secrets or leave them unset so defaults apply.

## Deploy

1. Build and push image (see `.github/workflows/backend-docker.yml`).
2. Set GitHub / server secrets to match `backend/.env.example` and production rules in `backend/src/config/env.ts`.
3. Run `deploy/scripts/verify-migration-safety.sh` before deploy. Destructive SQL requires explicit approval through `ALLOW_DESTRUCTIVE_MIGRATION=true`.
4. Run deploy workflow or copy `deploy/docker-compose.ghcr.yml` to the server as `docker-compose.yml`, set `BACKEND_IMAGE` and `.env`, then:

   ```bash
   ./deploy/scripts/deploy-release.sh /opt/ecommerce ghcr.io/acme/ecommerce-backend:<tag> https://api.example.com direct true
   ```

5. Confirm health:

   ```bash
   ./deploy/scripts/verify-stack-health.sh https://your-api-host
   ```

6. Run synthetic checks when tokens are available:

   ```bash
   ADMIN_API_TOKEN=... CUSTOMER_API_TOKEN=... ./deploy/scripts/synthetic-checks.sh https://your-api-host
   ```

## Rollback

- **Application**: use `deploy/scripts/rollback-release.sh /opt/ecommerce <known-good-image>` or allow the deploy workflow to auto-rollback after failed health checks.
- **Database**: restore from backup (below) before rolling forward again if a migration was applied; Prisma does not auto-downgrade.

## Backups

- **Postgres**: schedule `deploy/scripts/backup-postgres.sh` on the host (cron) or use managed-DB automated backups.
- **Redis**: treat as non-durable unless you rely on AOF for recovery; queue jobs are safe to lose only if you accept delayed processing.

Example cron (nightly, adjust paths and compose project name):

```cron
0 2 * * * /opt/ecommerce/deploy/scripts/backup-postgres.sh /opt/ecommerce/backups
```

## Restore drill (quarterly)

1. Take a fresh backup with `backup-postgres.sh`.
2. On a **staging** database, restore the dump and run `npx prisma migrate deploy` against the restored DB to confirm migration history matches.
3. Point a staging API at that DB and run `verify-stack-health.sh`.

## Scaling API replicas

- Run **multiple `api` containers** with the same image and env; **do not** run `prisma migrate deploy` inside each replica — the compose file’s `migrate` service handles that once per `compose up` orchestration.
- For platforms **without** Compose (Kubernetes): use a **Job** or init container that runs `npx prisma migrate deploy` to completion before new pods pass readiness.

## Secrets rotation

- Rotate **Clerk**, **Paystack**, **session**, **SMTP/API**, **Cloudinary**, and **Turnstile** credentials on provider consoles; update env; restart API and worker containers.
- After Clerk rotation, ensure webhooks and JWT validation still match Clerk dashboard settings.

## Monitoring

- Enable **Sentry** with `SENTRY_ENABLED=true` and a valid `SENTRY_DSN`.
- Watch API `/health` and `/ready` (readiness should reflect DB/Redis where implemented).
- Alert on worker container restarts and queue depth (BullMQ / Redis monitoring).
- Schedule `.github/workflows/synthetic-checks.yml` or an equivalent external probe for `/health`, `/ready`, and authenticated admin/customer smoke paths.

## CI / scheduled jobs

- Pull requests run **unit tests**, **integration tests** (with Postgres + Redis service containers), **Prisma validate + migrate deploy**, **production `npm audit` at critical**, and a full **TypeScript build**.
- The **nightly** workflow repeats the integration + build path and the same **critical-level production audit** for drift detection on `main`.

## Kubernetes / non-Compose platforms

- Replace the `migrate` service with a **pre-deploy Job** (or Helm hook) that runs `npx prisma migrate deploy` to completion before rolling out new API/worker pods.
