#!/usr/bin/env bash
set -euo pipefail
# scripts/ci-harness-gates.sh
# PURPOSE: Run harness validation + full lint stack in CI or local pipeline context.
# USAGE: bash scripts/ci-harness-gates.sh
# OUTPUT: Exits non-zero when required harness gates fail.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HARNESS_CORE_REPO="${HARNESS_CORE_REPO:-https://github.com/VisualGraphxLLC/dev-harness-core.git}"
HARNESS_CORE_REF="${HARNESS_CORE_REF:-main}"
HARNESS_CI_CORE_DIR="${HARNESS_CI_CORE_DIR:-$REPO_ROOT/.harness/.ci-core}"

resolve_core_path_from_config() {
  if [ ! -f "$REPO_ROOT/.harness/config.json" ]; then
    return 1
  fi
  python3 - <<'PY' "$REPO_ROOT/.harness/config.json"
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
try:
    data = json.loads(path.read_text())
except Exception:
    print("")
    sys.exit(1)
print(data.get("corePath", ""))
PY
}

resolve_harness_bin() {
  if command -v harness >/dev/null 2>&1; then
    command -v harness
    return 0
  fi

  if [ -n "${HARNESS_CORE_PATH:-}" ] && [ -x "${HARNESS_CORE_PATH}/bin/harness" ]; then
    echo "${HARNESS_CORE_PATH}/bin/harness"
    return 0
  fi

  config_core="$(resolve_core_path_from_config || true)"
  if [ -n "$config_core" ] && [ -x "$config_core/bin/harness" ]; then
    echo "$config_core/bin/harness"
    return 0
  fi

  mkdir -p "$(dirname "$HARNESS_CI_CORE_DIR")"
  rm -rf "$HARNESS_CI_CORE_DIR"

  if [ -n "${HARNESS_CORE_REPO_TOKEN:-}" ]; then
    # Inject token into URL (works with PATs, OAuth tokens, and installation tokens)
    AUTH_URL="$(echo "$HARNESS_CORE_REPO" | sed "s|https://github.com|https://x-access-token:${HARNESS_CORE_REPO_TOKEN}@github.com|")"
    git clone --depth 1 --branch "$HARNESS_CORE_REF" "$AUTH_URL" "$HARNESS_CI_CORE_DIR"
  else
    git clone --depth 1 --branch "$HARNESS_CORE_REF" "$HARNESS_CORE_REPO" "$HARNESS_CI_CORE_DIR"
  fi

  if [ ! -x "$HARNESS_CI_CORE_DIR/bin/harness" ]; then
    echo "error: unable to resolve harness binary" >&2
    return 1
  fi

  echo "$HARNESS_CI_CORE_DIR/bin/harness"
}

install_node_dependencies() {
  if ! command -v npm >/dev/null 2>&1; then
    return 0
  fi

  install_for_dir() {
    local dir="$1"
    if [ -f "$dir/package-lock.json" ]; then
      (cd "$dir" && npm ci --no-audit --no-fund)
    fi
  }

  install_for_dir "$REPO_ROOT"
  install_for_dir "$REPO_ROOT/frontend"
  install_for_dir "$REPO_ROOT/backend"
}

harness_bin="$(resolve_harness_bin)"
install_node_dependencies

"$harness_bin" validate "$REPO_ROOT"
"$harness_bin" lint-stack "$REPO_ROOT"
(cd "$REPO_ROOT" && bash scripts/verify-harness-model-routing.sh)
(cd "$REPO_ROOT" && bash scripts/verify-harness-role-evidence.sh)
