#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$ROOT/common.sh"

IMAGE="${1:-$IMAGE_DEFAULT}"
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT

gcloud config set project "$PROJECT" >/dev/null

API_URL=$(gcloud run services describe ecommerce-api --region="$REGION" --project="$PROJECT" --format='value(status.url)' 2>/dev/null || true)
if [[ -z "$API_URL" ]]; then
  echo "Deploy ecommerce-api first so APP_BASE_URL can be set." >&2
  exit 1
fi

write_env_file "$API_URL" "$ENV_FILE"

gcloud run deploy ecommerce-worker \
  --project="$PROJECT" \
  --image="$IMAGE" \
  --region="$REGION" \
  --command=node \
  --args=dist/src/bootstrap/worker.js \
  --vpc-connector="$CONNECTOR" \
  --vpc-egress=private-ranges-only \
  --set-cloudsql-instances="$SQL_INSTANCE" \
  --set-secrets="$SECRET_CSV" \
  --env-vars-file="$ENV_FILE" \
  --no-cpu-throttling \
  --min-instances=1 \
  --max-instances=1 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=3600 \
  --no-allow-unauthenticated \
  --quiet

echo "Worker deployed (min-instances=1, CPU always allocated). APP_BASE_URL=$API_URL"
