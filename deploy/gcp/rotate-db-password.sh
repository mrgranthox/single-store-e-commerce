#!/usr/bin/env bash
# Rotate/sync the Cloud SQL app user's password and the DATABASE_URL Secret Manager value.
set -euo pipefail

PROJECT="${GCP_PROJECT:-single-store-ecommerce-503510}"
REGION="${GCP_REGION:-europe-west1}"
INSTANCE_NAME="${CLOUD_SQL_INSTANCE_NAME:-ecommerce-pg}"
DB_USER="${DB_USER:-ecommerce_user}"
DB_PASSWORD_SECRET="${DB_PASSWORD_SECRET:-ecommerce-db-password}"
DATABASE_URL_SECRET="${DATABASE_URL_SECRET:-DATABASE_URL}"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT" >/dev/null
    echo "updated secret: $name"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT" >/dev/null
    echo "created secret: $name"
  fi
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT" >/dev/null
}

if [[ -n "${DB_PASSWORD:-}" ]]; then
  PASSWORD="$DB_PASSWORD"
  upsert_secret "$DB_PASSWORD_SECRET" "$PASSWORD"
else
  PASSWORD="$(gcloud secrets versions access latest --secret="$DB_PASSWORD_SECRET" --project="$PROJECT")"
fi

CURRENT_DATABASE_URL="$(gcloud secrets versions access latest --secret="$DATABASE_URL_SECRET" --project="$PROJECT")"
UPDATED_DATABASE_URL="$(python3 - "$CURRENT_DATABASE_URL" "$PASSWORD" "$DB_USER" <<'PY'
import sys
from urllib.parse import quote, urlsplit, urlunsplit

raw_url, password, db_user = sys.argv[1], sys.argv[2], sys.argv[3]
parts = urlsplit(raw_url)
if not parts.scheme or not parts.hostname:
    raise SystemExit("DATABASE_URL secret is not a valid PostgreSQL URL.")

username = quote(db_user, safe="")
encoded_password = quote(password, safe="")
host = parts.hostname
if ":" in host and not host.startswith("["):
    host = f"[{host}]"
netloc = f"{username}:{encoded_password}@{host}"
if parts.port:
    netloc = f"{netloc}:{parts.port}"

query = parts.query
if not query:
    query = "schema=public&sslmode=disable"

print(urlunsplit((parts.scheme, netloc, parts.path, query, parts.fragment)), end="")
PY
)"

upsert_secret "$DATABASE_URL_SECRET" "$UPDATED_DATABASE_URL"

gcloud sql users set-password "$DB_USER" \
  --instance="$INSTANCE_NAME" \
  --project="$PROJECT" \
  --password="$PASSWORD" \
  --quiet >/dev/null
echo "updated Cloud SQL user password: $DB_USER@$INSTANCE_NAME"

for service in ecommerce-api ecommerce-worker; do
  if gcloud run services describe "$service" --region="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud run services update "$service" \
      --region="$REGION" \
      --project="$PROJECT" \
      --update-secrets="${DATABASE_URL_SECRET}=${DATABASE_URL_SECRET}:latest" \
      --quiet >/dev/null
    echo "refreshed Cloud Run service secret binding: $service"
  fi
done

if gcloud run jobs describe ecommerce-migrate --region="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud run jobs update ecommerce-migrate \
    --region="$REGION" \
    --project="$PROJECT" \
    --update-secrets="${DATABASE_URL_SECRET}=${DATABASE_URL_SECRET}:latest" \
    --quiet >/dev/null
  echo "refreshed migration job secret binding: ecommerce-migrate"
fi

echo "Done. Run ./deploy/gcp/run-migrate.sh, then check /ready."
