#!/usr/bin/env bash
set -euo pipefail

# Dumps the postgres service from deploy/docker-compose.ghcr.yml (or cwd compose project).
# Usage: ./backup-postgres.sh [output_dir]
# Requires: docker compose, running postgres service named "postgres".

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/ecommerce-pg-${STAMP}.sql.gz"

echo "Writing $FILE"

docker compose exec -T postgres \
  sh -c 'pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-acl' \
  | gzip -c >"$FILE"

echo "Done."
