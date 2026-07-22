#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const failures = [];

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(repoRoot, relativePath));

const requireFile = (relativePath, label = relativePath) => {
  if (!exists(relativePath)) {
    failures.push(`Missing ${label}: ${relativePath}`);
  }
};

const requireSnippet = (relativePath, snippet, label) => {
  if (!exists(relativePath)) {
    failures.push(`Cannot check missing file: ${relativePath}`);
    return;
  }

  if (!read(relativePath).includes(snippet)) {
    failures.push(`${label} is missing "${snippet}" in ${relativePath}`);
  }
};

const requireAnySnippet = (relativePath, snippets, label) => {
  if (!exists(relativePath)) {
    failures.push(`Cannot check missing file: ${relativePath}`);
    return;
  }

  const contents = read(relativePath);
  if (!snippets.some((snippet) => contents.includes(snippet))) {
    failures.push(`${label} is missing one of: ${snippets.join(", ")} in ${relativePath}`);
  }
};

for (const file of [
  "admin-frontend/package.json",
  "admin-frontend/vite.config.ts",
  "admin-frontend/netlify.toml",
  "customer-frontend/package.json",
  "customer-frontend/vite.config.ts",
  "customer-frontend/netlify.toml",
  "mobile-frontend/src/integrations/backend-config.ts"
]) {
  requireFile(file, "frontend foundation");
}

for (const file of [
  "backend/src/app/app.ts",
  "backend/src/app/routes.ts",
  "backend/src/common/validation/validate-request.ts",
  "backend/src/common/middleware/cache-control.middleware.ts",
  "backend/src/common/middleware/rate-limit.middleware.ts"
]) {
  requireFile(file, "backend/API foundation");
}

for (const file of [
  "backend/prisma/schema.prisma",
  "backend/prisma/migrations/migration_lock.toml",
  "backend/src/config/prisma.ts",
  "backend/src/config/redis.ts",
  "backend/src/config/cloudinary.ts"
]) {
  requireFile(file, "database/storage foundation");
}

for (const file of [
  "backend/src/modules/auth/auth.middleware.ts",
  "backend/src/modules/auth/admin-auth.routes.ts",
  "backend/src/modules/auth/customer-auth.routes.ts",
  "backend/src/modules/roles-permissions/rbac.middleware.ts",
  "backend/scripts/verify-rbac-contracts.mjs"
]) {
  requireFile(file, "auth and permissions foundation");
}

for (const file of [
  "backend/Dockerfile",
  "docker-compose.yml",
  "deploy/docker-compose.ghcr.yml",
  "render.yaml",
  "deploy/scripts/deploy-release.sh",
  "deploy/scripts/rollback-release.sh",
  "deploy/scripts/verify-stack-health.sh",
  ".github/workflows/backend-ci.yml",
  ".github/workflows/frontend-ci.yml",
  ".github/workflows/security-gates.yml",
  ".github/workflows/backend-deploy.yml",
  ".github/dependabot.yml"
]) {
  requireFile(file, "hosting/deployment/CI foundation");
}

for (const file of [
  "backend/src/config/sentry.ts",
  "backend/src/config/logger.ts",
  "admin-frontend/src/lib/observability/sentry.ts",
  "customer-frontend/src/lib/observability/sentry.ts",
  "deploy/scripts/synthetic-checks.sh",
  "deploy/scripts/backup-postgres.sh",
  "deploy/RUNBOOK.md",
  "docs/production_readiness_matrix.md"
]) {
  requireFile(file, "observability/recovery foundation");
}

for (const frontendConfig of ["admin-frontend/netlify.toml", "customer-frontend/netlify.toml"]) {
  requireSnippet(frontendConfig, "Content-Security-Policy", "frontend security headers");
  requireSnippet(frontendConfig, "X-Frame-Options", "frontend clickjacking headers");
  requireSnippet(frontendConfig, "public, max-age=31536000, immutable", "frontend immutable asset caching");
  requireSnippet(frontendConfig, "no-cache, max-age=0, must-revalidate", "frontend SPA document cache policy");
}

requireSnippet("backend/src/app/app.ts", "helmet()", "backend security headers");
requireSnippet("backend/src/app/app.ts", "defaultNoStoreCacheControlMiddleware", "backend default API cache policy");
requireSnippet("backend/src/common/middleware/rate-limit.middleware.ts", "redis.incr", "Redis-backed rate limiting");
requireSnippet("backend/src/config/env.ts", "CORS_ALLOWED_ORIGINS must list explicit origins in production", "production CORS guard");
requireSnippet("backend/src/config/env.ts", "ALLOW_DEV_AUTH_BYPASS must not be enabled in production", "production auth-bypass guard");
requireSnippet("backend/Dockerfile", "USER nodejs", "non-root container runtime");
requireSnippet("deploy/docker-compose.ghcr.yml", "service_completed_successfully", "one-shot migration before replica startup");
requireSnippet("deploy/RUNBOOK.md", "Scaling API replicas", "load balancing/scaling runbook");
requireSnippet("deploy/RUNBOOK.md", "Restore drill", "availability/recovery runbook");
requireSnippet("docs/production_readiness_matrix.md", "Postgres RLS stance", "RLS architecture decision");
requireSnippet(".github/workflows/frontend-ci.yml", "npm test", "customer frontend test CI gate");
requireSnippet(".github/workflows/frontend-ci.yml", "npm run build", "customer frontend build CI gate");
requireAnySnippet(".github/workflows/security-gates.yml", ["gitleaks/gitleaks-action"], "secret scanning");

if (failures.length > 0) {
  console.error("Operational readiness verification failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Operational readiness controls OK.");
