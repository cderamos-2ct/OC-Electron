#!/usr/bin/env bash
# Validate all extraResources exist before running electron-builder
# Run from apps/openclaw-shell/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

ERRORS=0

check() {
  if [ -e "$1" ]; then
    echo "  OK: $1"
  else
    echo "  MISSING: $1"
    ERRORS=$((ERRORS + 1))
  fi
}

echo "=== Validating Electron Build Resources ==="
echo ""

echo "Workspace packages:"
check ../../packages/openclaw-core/dist
check ../../packages/openclaw-db/dist

echo ""
echo "Vendor binaries:"
check vendor/postgres/bin/postgres
check vendor/postgres/bin/initdb
check vendor/postgres/bin/pg_ctl
check vendor/gws/gws
check vendor/code-server/bin/code-server

echo ""
echo "Dashboard standalone:"
check ../../dashboard/.next/standalone/dashboard/server.cjs
check ../../dashboard/.next/standalone/dashboard/server.js
check ../../dashboard/.next/standalone/dashboard/.next/static

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "All resources present. Ready to package."
else
  echo "$ERRORS resource(s) missing. Fix before running electron-builder."
  exit 1
fi
