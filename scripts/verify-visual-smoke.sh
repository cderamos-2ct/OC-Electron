#!/usr/bin/env bash
set -euo pipefail
# scripts/verify-visual-smoke.sh
# PURPOSE: Require a non-skipped visual verification pass.
# USAGE: bash scripts/verify-visual-smoke.sh

resolve_harness_bin() {
  if command -v harness >/dev/null 2>&1; then
    command -v harness
    return 0
  fi
  if [ -f ".harness/config.json" ] && command -v python3 >/dev/null 2>&1; then
    core_path="$(python3 - <<'PY'
import json, pathlib
cfg = pathlib.Path(".harness/config.json")
try:
    data = json.loads(cfg.read_text())
except Exception:
    print("")
    raise SystemExit(0)
print(data.get("corePath", ""))
PY
)"
    if [ -n "$core_path" ] && [ -x "$core_path/bin/harness" ]; then
      echo "$core_path/bin/harness"
      return 0
    fi
  fi
  return 1
}

if ! harness_bin="$(resolve_harness_bin)"; then
  echo "error: harness binary not available for visual verification" >&2
  exit 1
fi

set +e
out="$("$harness_bin" lint-visual "$(pwd)" 2>&1)"
rc=$?
set -e
printf '%s\n' "$out"
if [ "$rc" -ne 0 ]; then
  exit "$rc"
fi

if command -v rg >/dev/null 2>&1; then
  if rg -qi '\[visual\] skipped|skipped:' <<<"$out"; then
    echo "error: visual verification was skipped; configure .harness/lint-policy.json.visual.command or Playwright config" >&2
    exit 1
  fi
fi

echo "verification=pass visual_smoke"
