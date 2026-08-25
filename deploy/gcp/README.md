# GCP deploy — `single-store-ecommerce-503510`

Region: **europe-west1**

## Provisioned (done)

| Resource | Name / value |
|---|---|
| Artifact Registry | `europe-west1-docker.pkg.dev/.../ecommerce` |
| Backend image | `.../backend:20260725-init` + `:latest` |
| VPC connector | `ecommerce-connector` (READY) |
| Cloud SQL | `ecommerce-pg` — private IP `10.36.0.3`, DB `ecommerce_db`, user `ecommerce_user` |
| Memorystore | `ecommerce-redis` — `10.196.144.163:6379` |
| Secrets | `DATABASE_URL`, `REDIS_URL`, `ecommerce-db-password` |
| IAM | Cloud Run default SA can read those secrets + Cloud SQL client |

## Rebuild / push image

```bash
cd backend
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA=$(date +%Y%m%d-%H%M%S) \
  --region=europe-west1
```

Or: `./deploy/gcp/build-push.sh`

## Next: create app secrets, then deploy

Cloud Run will not boot until these exist in Secret Manager (see `backend/.env.example`):

- `SESSION_SECRET`
- `APP_BASE_URL`, `ADMIN_APP_URL`, `CUSTOMER_APP_URL`, `MOBILE_APP_URL`
- `CORS_ALLOWED_ORIGINS`
- Clerk: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- Paystack: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_API_BASE_URL`

```bash
PROJECT=single-store-ecommerce-503510
SA="$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

create_secret () {
  local name="$1" value="$2"
  echo -n "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT" \
    || echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT"
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT" >/dev/null
}

# Example — replace with real values:
create_secret SESSION_SECRET "$(openssl rand -hex 32)"
create_secret PAYSTACK_API_BASE_URL "https://api.paystack.co"
# create_secret APP_BASE_URL "https://...."
# ...
```

Then:

```bash
./deploy/gcp/run-migrate.sh
./deploy/gcp/deploy-api.sh
./deploy/gcp/deploy-worker.sh
```

Order: migrate → API → worker.

Live API: `https://ecommerce-api-mul3xofi6a-ew.a.run.app`

## Database password rotation

`DATABASE_URL` embeds the Cloud SQL password. If the Cloud SQL user password is changed
without updating Secret Manager, Cloud Run will fail readiness with PostgreSQL `28P01`.

Use Secret Manager as the source of truth:

```bash
# Re-apply the existing ecommerce-db-password secret to Cloud SQL and refresh DATABASE_URL.
./deploy/gcp/rotate-db-password.sh

# Or rotate to a new password without printing it.
read -rsp "New DB password: " DB_PASSWORD; echo
DB_PASSWORD="$DB_PASSWORD" ./deploy/gcp/rotate-db-password.sh
unset DB_PASSWORD

./deploy/gcp/run-migrate.sh
curl -fsS https://ecommerce-api-mul3xofi6a-ew.a.run.app/ready
```

Do not edit only the Cloud SQL password in the console. Update both
`ecommerce-db-password` and `DATABASE_URL`, then refresh Cloud Run services so they
mount the latest secret versions.

## Seed admin login

Set `SEED_DEFAULT_ADMIN_EMAIL` and `SEED_DEFAULT_ADMIN_PASSWORD` in local
`backend/.env`, deploy a current backend image, then run:

```bash
./deploy/gcp/seed-admin.sh
```

The script creates a temporary Cloud Run job, runs `prisma db seed`, and deletes the
job and local temp env file afterward. The seed password is intentionally not uploaded
to Secret Manager because production app services reject `SEED_DEFAULT_ADMIN_PASSWORD`.

## Seed demo storefront and homepage

If the production database has no products yet, the public homepage intentionally
returns 404 until real shoppable content is published. For test environments, seed a
small demo catalog and publish a homepage with:

```bash
./deploy/gcp/seed-storefront-demo.sh
```

The script skips homepage publishing when a published homepage already exists. To
replace the published homepage with demo content:

```bash
FORCE_STOREFRONT_DEMO=1 ./deploy/gcp/seed-storefront-demo.sh
```

Webhook endpoints (update in provider dashboards if not already):

- Clerk: `https://ecommerce-api-mul3xofi6a-ew.a.run.app/api/v1/webhooks/clerk`
- Paystack: `https://ecommerce-api-mul3xofi6a-ew.a.run.app/api/v1/payments/webhook`

Netlify builds bake `VITE_BACKEND_BASE_URL` from each frontend `netlify.toml` — redeploy admin + customer sites after pull.
