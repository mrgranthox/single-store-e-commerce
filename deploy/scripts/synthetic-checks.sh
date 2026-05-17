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

cleanup_temp_file() {
  local path="${1:-}"
  if [[ -n "$path" && -f "$path" ]]; then
    rm -f "$path"
  fi
}

is_json_content_type() {
  local headers_file="$1"
  python3 - "$headers_file" <<'PY'
import sys

path = sys.argv[1]
content_type = ""
with open(path, "r", encoding="utf-8", errors="ignore") as handle:
    for line in handle:
        if line.lower().startswith("content-type:"):
            content_type = line.split(":", 1)[1].strip().lower()
            break

if "application/json" in content_type or "+json" in content_type:
    raise SystemExit(0)

raise SystemExit(1)
PY
}

validate_success_json_envelope() {
  local body_file="$1"
  python3 - "$body_file" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

if not isinstance(payload, dict) or payload.get("success") is not True:
    raise SystemExit(1)
PY
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

# Usage: http_json_ok <url> [curl args...]
http_json_ok() {
  local url="$1"
  shift

  local attempt=1
  local delay="$SYNTHETIC_INITIAL_DELAY_SEC"
  local code=""

  while (( attempt <= SYNTHETIC_MAX_ATTEMPTS )); do
    local body_file
    local headers_file
    body_file="$(mktemp)"
    headers_file="$(mktemp)"

    code="$(
      curl -sS -D "$headers_file" -o "$body_file" -w '%{http_code}' "$@" "$url" 2>/dev/null ||
        echo 000
    )"

    if [[ "$code" =~ ^2[0-9][0-9]$ ]] &&
      is_json_content_type "$headers_file" &&
      validate_success_json_envelope "$body_file"; then
      cleanup_temp_file "$body_file"
      cleanup_temp_file "$headers_file"
      return 0
    fi

    if is_transient_code "$code"; then
      echo "synthetic-checks: GET ${url} -> HTTP ${code} or invalid JSON envelope (attempt ${attempt}/${SYNTHETIC_MAX_ATTEMPTS}), retry in ${delay}s" >&2
      cleanup_temp_file "$body_file"
      cleanup_temp_file "$headers_file"
      sleep "$delay"
      if (( delay < 60 )); then
        delay=$((delay * 2))
      fi
      attempt=$((attempt + 1))
      continue
    fi

    echo "synthetic-checks: GET ${url} -> HTTP ${code} with non-JSON or invalid JSON response (non-retryable)" >&2
    cat "$headers_file" >&2 || true
    cat "$body_file" >&2 || true
    cleanup_temp_file "$body_file"
    cleanup_temp_file "$headers_file"
    return 1
  done

  echo "synthetic-checks: GET ${url} still not healthy after ${SYNTHETIC_MAX_ATTEMPTS} attempts (last HTTP ${code})" >&2
  return 1
}

http_ok "${BASE_URL}/health"
http_ok "${BASE_URL}/ready"
http_json_ok "${BASE_URL}/api/content/homepage"

if [[ -n "${ADMIN_API_TOKEN:-}" ]]; then
  http_ok "${BASE_URL}/api/admin/me" -H "Authorization: Bearer ${ADMIN_API_TOKEN}"
fi

if [[ -n "${CUSTOMER_API_TOKEN:-}" ]]; then
  http_ok "${BASE_URL}/api/account" -H "Authorization: Bearer ${CUSTOMER_API_TOKEN}"
fi

echo "Synthetic checks passed for ${BASE_URL}."
