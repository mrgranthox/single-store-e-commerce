# Backend Deployment and GitHub Hosting Prep

Date: 2026-03-28

## What is now prepared
- Docker image build for the backend in `backend/Dockerfile`
- local stack orchestration in [docker-compose.yml](/home/edward-nyame/Desktop/E-commerce/docker-compose.yml)
- GHCR deployment stack in [docker-compose.ghcr.yml](/home/edward-nyame/Desktop/E-commerce/deploy/docker-compose.ghcr.yml)
- GitHub Actions CI in [backend-ci.yml](/home/edward-nyame/Desktop/E-commerce/.github/workflows/backend-ci.yml)
- GitHub Actions image publish in [backend-docker.yml](/home/edward-nyame/Desktop/E-commerce/.github/workflows/backend-docker.yml)
- GitHub Actions remote deploy in [backend-deploy.yml](/home/edward-nyame/Desktop/E-commerce/.github/workflows/backend-deploy.yml)

## Important constraint
- GitHub does not host Postgres or Redis directly.
- What GitHub can do here is:
  - run CI
  - build and publish the backend Docker image to GHCR
  - deploy the stack to your own Docker host or cloud VM over SSH

## Services covered by the prepared stack
- API
- worker
- Postgres
- Redis

## Required GitHub secrets
- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `DEPLOY_PATH`
- `GHCR_PAT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `REDIS_URL`
- `APP_BASE_URL`
- `ADMIN_APP_URL`
- `CUSTOMER_APP_URL`
- `MOBILE_APP_URL`
- `CORS_ALLOWED_ORIGINS`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `SENTRY_DSN`
- `SENTRY_ENABLED`
- `PAYMENT_PROVIDER`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `EMAIL_PROVIDER`
- `BREVO_SMTP_HOST`
- `BREVO_SMTP_PORT`
- `BREVO_SMTP_LOGIN`
- `BREVO_SMTP_PASSWORD`
- `BREVO_API_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `EMAIL_REPLY_TO`
- `STORAGE_PROVIDER`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `ABUSE_CHALLENGE_PROVIDER`
- `PUBLIC_SUPPORT_CAPTCHA_ENABLED`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `SESSION_SECRET`
- `LOG_LEVEL`

## Recommended live-hosting flow
1. Merge to `main`.
2. Let GitHub Actions run CI and publish `ghcr.io/<owner>/ecommerce-backend`.
3. Trigger the deploy workflow with the image tag you want.
4. The remote host pulls the image and runs:
   - Postgres
   - Redis
   - API
   - worker
5. Verify:
   - `GET /health`
   - `GET /ready`
   - worker startup logs
   - webhook and email connectivity
