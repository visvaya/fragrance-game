#!/usr/bin/env bash
# Scans the paths an artifact step is about to upload for secrets, inside archives too (Playwright
# traces are zip files). Job-log masking does not cover artifacts, and this repository's artifacts
# are public, so the upload step runs only when this scan passes. Two checks:
# - gitleaks with tools/gitleaks/artifacts.toml, for secrets of a known shape;
# - the exact values of the secrets this job holds (environment variables named like a key, secret,
#   token or password, except the public NEXT_PUBLIC_ ones), also where no rule knows their shape.
# Usage: .github/scripts/scan-artifacts.sh <path>...  (missing paths are skipped)
set -euo pipefail

paths=()
for path in "$@"; do
  if [ -e "$path" ]; then paths+=("$path"); else echo "skip $path (not present)"; fi
done
[ "${#paths[@]}" -gt 0 ] || exit 0

docker build --quiet --tag artifact-gitleaks tools/gitleaks >/dev/null
for path in "${paths[@]}"; do
  docker run --rm --volume "$PWD:/repo" --workdir /repo artifact-gitleaks \
    dir "$path" --config tools/gitleaks/artifacts.toml --max-archive-depth 3 --redact --no-banner
done

found=0
for name in $(compgen -e | grep -E 'KEY|SECRET|TOKEN|PASSWORD' | grep -v '^NEXT_PUBLIC_'); do
  value="${!name}"
  [ "${#value}" -ge 16 ] || continue
  for path in "${paths[@]}"; do
    plain=$(grep -rlF -- "$value" "$path" || true)
    zipped=$(find "$path" -name '*.zip' -print0 | xargs -0 -r -I{} unzip -p {} 2>/dev/null | grep -cF -- "$value" || true)
    if [ -n "$plain" ] || [ "${zipped:-0}" -gt 0 ]; then
      echo "::error::the value of $name is in $path"
      found=1
    fi
  done
done
exit "$found"
