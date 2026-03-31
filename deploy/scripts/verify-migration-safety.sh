#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="${ROOT_DIR}/backend/prisma/migrations"
ALLOW_DESTRUCTIVE="${ALLOW_DESTRUCTIVE_MIGRATION:-false}"

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "No migrations directory found at ${MIGRATIONS_DIR}."
  exit 0
fi

latest_migration_file="$(ls -1 "${MIGRATIONS_DIR}"/*/migration.sql 2>/dev/null | sort | tail -n 1 || true)"

if [[ -z "${latest_migration_file}" ]]; then
  echo "No migration.sql files found."
  exit 0
fi

if rg -n 'DROP COLUMN|DROP TABLE|ALTER TABLE .* DROP CONSTRAINT|ALTER TABLE .* ALTER COLUMN .* TYPE' "${latest_migration_file}" >/dev/null; then
  if [[ "${ALLOW_DESTRUCTIVE}" != "true" ]]; then
    echo "Potentially destructive migration detected in ${latest_migration_file}."
    echo "Set ALLOW_DESTRUCTIVE_MIGRATION=true only for an explicitly reviewed deploy."
    exit 1
  fi
fi

echo "Migration safety check passed for ${latest_migration_file}."
