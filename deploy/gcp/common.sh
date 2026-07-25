#!/usr/bin/env bash
# Shared Cloud Run wiring for API + worker.
set -euo pipefail

PROJECT="${GCP_PROJECT:-single-store-ecommerce-503510}"
REGION="${GCP_REGION:-europe-west1}"
IMAGE_DEFAULT="${REGION}-docker.pkg.dev/${PROJECT}/ecommerce/backend:latest"
SQL_INSTANCE="${SQL_INSTANCE:-${PROJECT}:${REGION}:ecommerce-pg}"
CONNECTOR="${VPC_CONNECTOR:-projects/${PROJECT}/locations/${REGION}/connectors/ecommerce-connector}"

SECRET_CSV="DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,CLERK_PUBLISHABLE_KEY=CLERK_PUBLISHABLE_KEY:latest,CLERK_SECRET_KEY=CLERK_SECRET_KEY:latest,CLERK_WEBHOOK_SECRET=CLERK_WEBHOOK_SECRET:latest,PAYSTACK_SECRET_KEY=PAYSTACK_SECRET_KEY:latest,PAYSTACK_PUBLIC_KEY=PAYSTACK_PUBLIC_KEY:latest,PAYSTACK_WEBHOOK_SECRET=PAYSTACK_WEBHOOK_SECRET:latest,BREVO_API_KEY=BREVO_API_KEY:latest,BREVO_SMTP_LOGIN=BREVO_SMTP_LOGIN:latest,CLOUDINARY_API_KEY=CLOUDINARY_API_KEY:latest,CLOUDINARY_API_SECRET=CLOUDINARY_API_SECRET:latest,SENTRY_DSN=SENTRY_DSN:latest"

# Write env vars as YAML so commas in CORS_ALLOWED_ORIGINS do not break gcloud parsing.
write_env_file() {
  local app_base_url="$1"
  local out="$2"
  cat >"$out" <<EOF
NODE_ENV: "production"
AUTOMATION_SCHEDULES_ENABLED: "true"
QUEUE_PREFIX: "ecommerce"
PAYMENT_PROVIDER: "paystack"
PAYSTACK_API_BASE_URL: "https://api.paystack.co"
PAYSTACK_DEFAULT_CURRENCY: "GHS"
PAYSTACK_VERIFY_TRANSACTIONS: "true"
PAYSTACK_CALLBACK_URL: "https://teescollections.netlify.app/checkout/payment/result"
APP_BASE_URL: "${app_base_url}"
ADMIN_APP_URL: "https://teescollection.netlify.app"
CUSTOMER_APP_URL: "https://teescollections.netlify.app"
MOBILE_APP_URL: "https://teescollectionmobile.netlify.app"
CORS_ALLOWED_ORIGINS: "https://teescollection.netlify.app,https://teescollections.netlify.app,https://teescollectionmobile.netlify.app"
EMAIL_PROVIDER: "brevo"
BREVO_API_BASE_URL: "https://api.brevo.com/v3"
EMAIL_FROM: "aicontent.edy@gmail.com"
EMAIL_FROM_NAME: "E-Commerce Platform"
STORAGE_PROVIDER: "cloudinary"
CLOUDINARY_CLOUD_NAME: "dfqe67lnn"
SENTRY_ENABLED: "true"
SENTRY_ENVIRONMENT: "gcp-europe-west1"
SENTRY_TRACES_SAMPLE_RATE: "0.1"
EOF
}
