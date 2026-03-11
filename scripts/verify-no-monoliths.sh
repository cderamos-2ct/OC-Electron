#!/usr/bin/env bash
set -euo pipefail
# scripts/verify-no-monoliths.sh
# PURPOSE: Enforce no-monolith policy via harness structure/function checks.
# USAGE: bash scripts/verify-no-monoliths.sh

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

if harness_bin="$(resolve_harness_bin)"; then
  "$harness_bin" lint-structure "$(pwd)"
  "$harness_bin" lint-functions "$(pwd)"
else
  echo "error: harness binary not available for no-monolith verification" >&2
  exit 1
fi

echo "verification=pass no_monoliths"
