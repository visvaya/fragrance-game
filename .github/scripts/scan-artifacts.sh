#!/usr/bin/env bash
# Scans the paths an artifact step is about to upload for secrets, inside archives too (Playwright
# traces are zip files). Job-log masking does not cover artifacts, and this repository's artifacts
# are public, so the upload step runs only when this scan passes. Rules: tools/gitleaks/artifacts.toml.
# Usage: .github/scripts/scan-artifacts.sh <path>...  (missing paths are skipped)
set -euo pipefail

docker build --quiet --tag artifact-gitleaks tools/gitleaks >/dev/null
for path in "$@"; do
  if [ ! -e "$path" ]; then
    echo "skip $path (not present)"
    continue
  fi
  docker run --rm --volume "$PWD:/repo" --workdir /repo artifact-gitleaks \
    dir "$path" --config tools/gitleaks/artifacts.toml --max-archive-depth 3 --redact --no-banner
done
