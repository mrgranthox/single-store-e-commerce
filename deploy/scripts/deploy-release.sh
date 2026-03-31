#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${1:?deploy path is required}"
IMAGE_TAG="${2:?image tag is required}"
HEALTH_URL="${3:?health url is required}"
ROLLOUT_STRATEGY="${4:-direct}"
AUTO_ROLLBACK="${5:-true}"

cd "${DEPLOY_PATH}"

mkdir -p "${DEPLOY_PATH}"

previous_image_tag="$(
  python3 - <<'PY'
from pathlib import Path
env_file = Path(".env")
if not env_file.exists():
    print("")
    raise SystemExit(0)
for line in env_file.read_text().splitlines():
    if line.startswith("BACKEND_IMAGE="):
        print(line.split("=", 1)[1])
        break
else:
    print("")
PY
)"

cat > .release-state <<EOF
PREVIOUS_IMAGE_TAG=${previous_image_tag}
TARGET_IMAGE_TAG=${IMAGE_TAG}
ROLLOUT_STRATEGY=${ROLLOUT_STRATEGY}
EOF

IMAGE_TAG="${IMAGE_TAG}" python3 - <<'PY'
from pathlib import Path
import os
env_file = Path(".env")
text = env_file.read_text() if env_file.exists() else ""
replacement = []
found = False
for line in text.splitlines():
    if line.startswith("BACKEND_IMAGE="):
        replacement.append(f"BACKEND_IMAGE={os.environ['IMAGE_TAG']}")
        found = True
    else:
        replacement.append(line)
if not found:
    replacement.append(f"BACKEND_IMAGE={os.environ['IMAGE_TAG']}")
env_file.write_text("\n".join(replacement).strip() + "\n")
PY

echo "Starting ${ROLLOUT_STRATEGY} deployment for ${IMAGE_TAG}."
docker compose pull
docker compose up -d

if ! "$(dirname "${BASH_SOURCE[0]}")/verify-stack-health.sh" "${HEALTH_URL}"; then
  echo "Post-deploy health verification failed."
  if [[ "${AUTO_ROLLBACK}" == "true" && -n "${previous_image_tag}" ]]; then
    export ROLLBACK_IMAGE_TAG="${previous_image_tag}"
    "$(dirname "${BASH_SOURCE[0]}")/rollback-release.sh" "${DEPLOY_PATH}" "${previous_image_tag}"
  fi
  exit 1
fi

echo "Deployment completed for ${IMAGE_TAG}."
