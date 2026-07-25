#!/usr/bin/env bash
set -euo pipefail

PROJECT="${GCP_PROJECT:-single-store-ecommerce-503510}"
REGION="${GCP_REGION:-europe-west1}"
TAG="${1:-$(date +%Y%m%d-%H%M%S)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/ecommerce/backend:${TAG}"
LATEST="${REGION}-docker.pkg.dev/${PROJECT}/ecommerce/backend:latest"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

gcloud config set project "$PROJECT" >/dev/null
gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin "https://${REGION}-docker.pkg.dev"

docker build -t "$IMAGE" -t "$LATEST" "$ROOT/backend"
docker push "$IMAGE"
docker push "$LATEST"

echo "$IMAGE"
