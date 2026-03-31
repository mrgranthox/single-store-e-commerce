#!/usr/bin/env bash
set -euo pipefail

# Usage: ./verify-stack-health.sh [BASE_URL]
# Default: http://127.0.0.1:4000

BASE_URL="${1:-http://127.0.0.1:4000}"
BASE_URL="${BASE_URL%/}"

for path in /health /ready; do
  code="$(curl -sS -o /tmp/ecom-health-body -w "%{http_code}" "${BASE_URL}${path}" || true)"
  if [[ "$code" != "200" ]]; then
    echo "FAIL ${BASE_URL}${path} HTTP $code"
    cat /tmp/ecom-health-body 2>/dev/null || true
    exit 1
  fi
  echo "OK   ${BASE_URL}${path} HTTP $code"
done

rm -f /tmp/ecom-health-body
