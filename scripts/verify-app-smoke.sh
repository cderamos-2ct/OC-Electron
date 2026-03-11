#!/usr/bin/env bash
set -euo pipefail
# scripts/verify-app-smoke.sh
# PURPOSE: Verify the app can build/smoke using project policy command or build scripts.
# USAGE: bash scripts/verify-app-smoke.sh

REPO="$(pwd)"
policy_cmd=""

if [ -f "$REPO/.harness/task-quality-policy.json" ] && command -v jq >/dev/null 2>&1; then
  policy_cmd="$(jq -r '.appSmokeCommand // ""' "$REPO/.harness/task-quality-policy.json")"
fi

if [ -n "$policy_cmd" ]; then
  echo "[app-smoke] running configured command: $policy_cmd"
  bash -lc "$policy_cmd"
  echo "verification=pass app_smoke"
  exit 0
fi

has_npm_script() {
  local package_json="$1"
  local script_name="$2"
  [ -f "$package_json" ] || return 1
  command -v jq >/dev/null 2>&1 || return 1
  jq -e ".scripts[\"$script_name\"]" "$package_json" >/dev/null 2>&1
}

ran=0
failed=0

if has_npm_script "$REPO/frontend/package.json" "build"; then
  ran=1
  if ! (cd "$REPO/frontend" && npm run build); then
    failed=1
  fi
fi

if has_npm_script "$REPO/backend/package.json" "build"; then
  ran=1
  if ! (cd "$REPO/backend" && npm run build); then
    failed=1
  fi
fi

if has_npm_script "$REPO/package.json" "build"; then
  ran=1
  if ! (cd "$REPO" && npm run build); then
    failed=1
  fi
fi

if [ "$ran" -eq 0 ]; then
  echo "error: app smoke not configured; set .harness/task-quality-policy.json.appSmokeCommand" >&2
  exit 1
fi

if [ "$failed" -ne 0 ]; then
  echo "error: app smoke build command failed" >&2
  exit 1
fi

echo "verification=pass app_smoke"
