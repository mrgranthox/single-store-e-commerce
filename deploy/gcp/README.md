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

Webhook endpoints (update in provider dashboards if not already):

- Clerk: `https://ecommerce-api-mul3xofi6a-ew.a.run.app/api/v1/webhooks/clerk`
- Paystack: `https://ecommerce-api-mul3xofi6a-ew.a.run.app/api/v1/payments/webhook`

Netlify builds bake `VITE_BACKEND_BASE_URL` from each frontend `netlify.toml` — redeploy admin + customer sites after pull.
