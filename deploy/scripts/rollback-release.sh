#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${1:?deploy path is required}"
ROLLBACK_IMAGE_TAG="${2:-}"

cd "${DEPLOY_PATH}"

if [[ ! -f .release-state ]]; then
  echo "Missing .release-state in ${DEPLOY_PATH}."
  exit 1
fi

if [[ -z "${ROLLBACK_IMAGE_TAG}" ]]; then
  # shellcheck disable=SC1091
  source .release-state
  ROLLBACK_IMAGE_TAG="${PREVIOUS_IMAGE_TAG:-}"
fi

if [[ -z "${ROLLBACK_IMAGE_TAG}" ]]; then
  echo "No previous image tag available for rollback."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
env_file = Path(".env")
text = env_file.read_text()
replacement = []
found = False
for line in text.splitlines():
    if line.startswith("BACKEND_IMAGE="):
        replacement.append(f"BACKEND_IMAGE={__import__('os').environ['ROLLBACK_IMAGE_TAG']}")
        found = True
    else:
        replacement.append(line)
if not found:
    replacement.append(f"BACKEND_IMAGE={__import__('os').environ['ROLLBACK_IMAGE_TAG']}")
env_file.write_text("\n".join(replacement) + "\n")
PY

docker compose pull
docker compose up -d
echo "Rollback completed to ${ROLLBACK_IMAGE_TAG}."
