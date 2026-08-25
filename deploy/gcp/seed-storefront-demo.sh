#!/usr/bin/env bash
# Seed demo catalog records and publish a homepage via a short-lived Cloud Run job.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/deploy/gcp/common.sh"

JOB_NAME="${JOB_NAME:-ecommerce-seed-storefront-demo}"
IMAGE="${IMAGE:-$(gcloud run services describe ecommerce-api --region="$REGION" --project="$PROJECT" --format='value(spec.template.spec.containers[0].image)')}"
FORCE_STOREFRONT_DEMO="${FORCE_STOREFRONT_DEMO:-0}"

cleanup() {
  gcloud run jobs delete "$JOB_NAME" --region="$REGION" --project="$PROJECT" --quiet >/dev/null 2>&1 || true
}
trap cleanup EXIT

gcloud run jobs delete "$JOB_NAME" --region="$REGION" --project="$PROJECT" --quiet >/dev/null 2>&1 || true

gcloud run jobs create "$JOB_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --vpc-connector="$CONNECTOR" \
  --vpc-egress=private-ranges-only \
  --set-cloudsql-instances="$SQL_INSTANCE" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --set-env-vars="NODE_ENV=production,FORCE_STOREFRONT_DEMO=${FORCE_STOREFRONT_DEMO}" \
  --command=node \
  --args=scripts/seed-storefront-demo.mjs \
  --max-retries=0 \
  --task-timeout=10m \
  --quiet >/dev/null

echo "Running demo storefront seed job with image: $IMAGE"
gcloud run jobs execute "$JOB_NAME" --region="$REGION" --project="$PROJECT" --wait
echo "Demo storefront seed completed."
