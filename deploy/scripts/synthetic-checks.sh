#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:?base url is required}"

curl --fail --silent --show-error "${BASE_URL%/}/health" >/dev/null
curl --fail --silent --show-error "${BASE_URL%/}/ready" >/dev/null

if [[ -n "${ADMIN_API_TOKEN:-}" ]]; then
  curl --fail --silent --show-error \
    -H "Authorization: Bearer ${ADMIN_API_TOKEN}" \
    "${BASE_URL%/}/api/admin/me" >/dev/null
fi

if [[ -n "${CUSTOMER_API_TOKEN:-}" ]]; then
  curl --fail --silent --show-error \
    -H "Authorization: Bearer ${CUSTOMER_API_TOKEN}" \
    "${BASE_URL%/}/api/account" >/dev/null
fi

echo "Synthetic checks passed for ${BASE_URL}."
