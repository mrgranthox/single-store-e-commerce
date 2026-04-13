#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:?base url is required}"
BASE_URL="${BASE_URL%/}"

SYNTHETIC_MAX_ATTEMPTS="${SYNTHETIC_MAX_ATTEMPTS:-12}"
SYNTHETIC_INITIAL_DELAY_SEC="${SYNTHETIC_INITIAL_DELAY_SEC:-5}"

# Transient errors from cold start, deploy, or edge — retry before failing the job.
is_transient_code() {
  case "$1" in
    429 | 502 | 503 | 504) return 0 ;;
    000 | "") return 0 ;; # connection refused / DNS / no response
    *) return 1 ;;
  esac
}

# Usage: http_ok <url> [curl args...]
http_ok() {
  local url="$1"
  shift
  local -a curl_base=(curl -sS -o /dev/null -w '%{http_code}' "$@" "$url")
  local attempt=1
  local delay="$SYNTHETIC_INITIAL_DELAY_SEC"
  local code
  while (( attempt <= SYNTHETIC_MAX_ATTEMPTS )); do
    code="$("${curl_base[@]}" 2>/dev/null || echo 000)"
    if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
      return 0
    fi
    if is_transient_code "$code"; then
      echo "synthetic-checks: GET ${url} -> HTTP ${code} (attempt ${attempt}/${SYNTHETIC_MAX_ATTEMPTS}), retry in ${delay}s" >&2
      sleep "$delay"
      if (( delay < 60 )); then
        delay=$((delay * 2))
      fi
      attempt=$((attempt + 1))
      continue
    fi
    echo "synthetic-checks: GET ${url} -> HTTP ${code} (non-retryable)" >&2
    curl -sS --fail --show-error "$@" "$url" >&2 || true
    return 1
  done
  echo "synthetic-checks: GET ${url} still not OK after ${SYNTHETIC_MAX_ATTEMPTS} attempts (last HTTP ${code})" >&2
  return 1
}

http_ok "${BASE_URL}/health"
http_ok "${BASE_URL}/ready"

if [[ -n "${ADMIN_API_TOKEN:-}" ]]; then
  http_ok "${BASE_URL}/api/admin/me" -H "Authorization: Bearer ${ADMIN_API_TOKEN}"
fi

if [[ -n "${CUSTOMER_API_TOKEN:-}" ]]; then
  http_ok "${BASE_URL}/api/account" -H "Authorization: Bearer ${CUSTOMER_API_TOKEN}"
fi

echo "Synthetic checks passed for ${BASE_URL}."
