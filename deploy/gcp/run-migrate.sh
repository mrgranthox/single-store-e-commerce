#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$ROOT/common.sh"

IMAGE="${1:-$IMAGE_DEFAULT}"

gcloud config set project "$PROJECT" >/dev/null

gcloud run jobs deploy ecommerce-migrate \
  --project="$PROJECT" \
  --image="$IMAGE" \
  --region="$REGION" \
  --vpc-connector="$CONNECTOR" \
  --vpc-egress=private-ranges-only \
  --set-cloudsql-instances="$SQL_INSTANCE" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --set-env-vars="NODE_ENV=production" \
  --command=npx \
  --args=prisma,migrate,deploy \
  --max-retries=1 \
  --task-timeout=15m \
  --memory=1Gi \
  --cpu=1 \
  --execute-now \
  --wait

echo "Migrate job finished successfully."
