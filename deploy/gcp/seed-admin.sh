#!/usr/bin/env bash
# Run the Prisma seed in a short-lived Cloud Run job using local backend/.env seed values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/deploy/gcp/common.sh"

ENV_FILE="${ENV_FILE:-$ROOT/backend/.env}"
JOB_NAME="${JOB_NAME:-ecommerce-seed-admin}"
IMAGE="${IMAGE:-$(gcloud run services describe ecommerce-api --region="$REGION" --project="$PROJECT" --format='value(spec.template.spec.containers[0].image)')}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

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

require_env() {
  local key="$1"
  local value
  value="$(get_env "$key")"
  if [[ -z "$value" ]]; then
    echo "Missing required $key in $ENV_FILE" >&2
    exit 1
  fi
  printf '%s' "$value"
}

SEED_DEFAULT_ADMIN_EMAIL="$(require_env SEED_DEFAULT_ADMIN_EMAIL)"
SEED_DEFAULT_ADMIN_PASSWORD="$(require_env SEED_DEFAULT_ADMIN_PASSWORD)"
SEED_DEFAULT_ADMIN_PHONE="$(get_env SEED_DEFAULT_ADMIN_PHONE)"
SEED_DEFAULT_ADMIN_ROLE="$(get_env SEED_DEFAULT_ADMIN_ROLE)"

TMP_ENV="$(mktemp)"
chmod 600 "$TMP_ENV"
cleanup() {
  python3 - "$TMP_ENV" <<'PY'
import os
import sys

path = sys.argv[1]
try:
    if os.path.exists(path):
        with open(path, "ba", buffering=0) as handle:
            handle.write(b"\0" * max(1, os.path.getsize(path)))
        os.remove(path)
except OSError:
    pass
PY
  gcloud run jobs delete "$JOB_NAME" --region="$REGION" --project="$PROJECT" --quiet >/dev/null 2>&1 || true
}
trap cleanup EXIT

python3 - "$TMP_ENV" "$SEED_DEFAULT_ADMIN_EMAIL" "$SEED_DEFAULT_ADMIN_PASSWORD" "$SEED_DEFAULT_ADMIN_PHONE" "${SEED_DEFAULT_ADMIN_ROLE:-super_admin}" <<'PY'
import json
import sys

path, email, password, phone, role = sys.argv[1:6]
values = {
    "NODE_ENV": "development",
    "AUTOMATION_SCHEDULES_ENABLED": "false",
    "QUEUE_PREFIX": "ecommerce",
    "APP_BASE_URL": "https://ecommerce-api-mul3xofi6a-ew.a.run.app",
    "ADMIN_APP_URL": "https://teescollection.netlify.app",
    "CUSTOMER_APP_URL": "https://teescollections.netlify.app",
    "MOBILE_APP_URL": "https://teescollectionmobile.netlify.app",
    "CORS_ALLOWED_ORIGINS": "https://teescollection.netlify.app,https://teescollections.netlify.app,https://teescollectionmobile.netlify.app",
    "PAYMENT_PROVIDER": "paystack",
    "PAYSTACK_API_BASE_URL": "https://api.paystack.co",
    "PAYSTACK_DEFAULT_CURRENCY": "GHS",
    "SEED_DEFAULT_ADMIN_EMAIL": email,
    "SEED_DEFAULT_ADMIN_PASSWORD": password,
    "SEED_DEFAULT_ADMIN_ROLE": role or "super_admin",
}
if phone:
    values["SEED_DEFAULT_ADMIN_PHONE"] = phone

with open(path, "w", encoding="utf-8") as handle:
    for key, value in values.items():
        handle.write(f"{key}: {json.dumps(value)}\n")
PY

gcloud run jobs delete "$JOB_NAME" --region="$REGION" --project="$PROJECT" --quiet >/dev/null 2>&1 || true

gcloud run jobs create "$JOB_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --vpc-connector="$CONNECTOR" \
  --vpc-egress=private-ranges-only \
  --set-cloudsql-instances="$SQL_INSTANCE" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest" \
  --env-vars-file="$TMP_ENV" \
  --command=npx \
  --args=prisma,db,seed \
  --max-retries=0 \
  --task-timeout=10m \
  --quiet >/dev/null

echo "Running admin seed job with image: $IMAGE"
gcloud run jobs execute "$JOB_NAME" --region="$REGION" --project="$PROJECT" --wait
echo "Admin seed completed."
