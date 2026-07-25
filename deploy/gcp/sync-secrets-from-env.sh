#!/usr/bin/env bash
# Sync non-infra secrets from backend/.env → Secret Manager.
# Never overwrites DATABASE_URL / REDIS_URL (those are Cloud SQL + Memorystore).
# Never uploads SEED_DEFAULT_ADMIN_PASSWORD or ALLOW_DEV_AUTH_BYPASS.
set -euo pipefail

PROJECT="${GCP_PROJECT:-single-store-ecommerce-503510}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Credentials only — public URLs / feature flags go on Cloud Run as env vars.
SECRET_KEYS=(
  SESSION_SECRET
  CLERK_PUBLISHABLE_KEY
  CLERK_SECRET_KEY
  CLERK_WEBHOOK_SECRET
  PAYSTACK_SECRET_KEY
  PAYSTACK_PUBLIC_KEY
  PAYSTACK_WEBHOOK_SECRET
  BREVO_API_KEY
  BREVO_SMTP_LOGIN
  BREVO_SMTP_PASSWORD
  CLOUDINARY_API_KEY
  CLOUDINARY_API_SECRET
  SENTRY_DSN
)

upsert_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "skip empty: $name"
    return 0
  fi
  if gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT" >/dev/null
    echo "updated: $name"
  else
    echo -n "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT" >/dev/null
    echo "created: $name"
  fi
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT" >/dev/null
}

# Parse KEY=VALUE from .env without exporting into this shell's environment dump.
get_env() {
  local key="$1"
  python3 - "$ENV_FILE" "$key" <<'PY'
import sys
from pathlib import Path
path, key = sys.argv[1], sys.argv[2]
for raw in Path(path).read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    if k.strip() != key:
        continue
    v = v.strip()
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        v = v[1:-1]
    print(v, end="")
    break
PY
}

echo "Syncing secrets from $ENV_FILE → project $PROJECT (SA=$SA)"
for key in "${SECRET_KEYS[@]}"; do
  value="$(get_env "$key")"
  upsert_secret "$key" "$value"
done

echo "Done. DATABASE_URL / REDIS_URL left untouched (GCP-managed)."
