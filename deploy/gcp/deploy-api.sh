#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$ROOT/common.sh"

IMAGE="${1:-$IMAGE_DEFAULT}"
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT

gcloud config set project "$PROJECT" >/dev/null

EXISTING_URL=$(gcloud run services describe ecommerce-api --region="$REGION" --project="$PROJECT" --format='value(status.url)' 2>/dev/null || true)
APP_BASE_URL="${EXISTING_URL:-https://ecommerce-api-mul3xofi6a-ew.a.run.app}"
write_env_file "$APP_BASE_URL" "$ENV_FILE"

gcloud run deploy ecommerce-api \
  --project="$PROJECT" \
  --image="$IMAGE" \
  --region="$REGION" \
  --port=4000 \
  --vpc-connector="$CONNECTOR" \
  --vpc-egress=private-ranges-only \
  --set-cloudsql-instances="$SQL_INSTANCE" \
  --set-secrets="$SECRET_CSV" \
  --env-vars-file="$ENV_FILE" \
  --min-instances=1 \
  --max-instances=10 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --cpu-boost \
  --allow-unauthenticated \
  --quiet

API_URL=$(gcloud run services describe ecommerce-api --region="$REGION" --project="$PROJECT" --format='value(status.url)')
echo "API_URL=$API_URL"

if [[ "$API_URL" != "$APP_BASE_URL" ]]; then
  echo "Updating APP_BASE_URL → $API_URL"
  gcloud run services update ecommerce-api \
    --project="$PROJECT" \
    --region="$REGION" \
    --update-env-vars="APP_BASE_URL=${API_URL}" \
    --quiet
fi

echo "$API_URL"
