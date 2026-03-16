#!/usr/bin/env bash
set -euo pipefail
# scripts/verify-design-system.sh
# PURPOSE: Enforce baseline design-system hygiene for UI repositories.
# USAGE: bash scripts/verify-design-system.sh

REPO="$(pwd)"

found=0
for path in \
  "frontend/src/design-system" \
  "frontend/src/components/ui" \
  "frontend/src/styles/tokens.css" \
  "frontend/src/styles/design-system.css" \
  "frontend/src/styles/global-design-system.css" \
  "dashboard/styles/tokens.css" \
  "dashboard/components/ui" \
  "dashboard/app/globals.css"; do
  if [ -e "$REPO/$path" ]; then
    found=1
    break
  fi
done

if [ "$found" -eq 0 ]; then
  echo "error: no design-system anchor found (expected one of: frontend/src/design-system, frontend/src/components/ui, frontend/src/styles/tokens.css)" >&2
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  inline_hits="$(rg -n --glob '*.{vue,tsx,jsx,html}' '[[:space:]]style=' "$REPO/frontend/src" "$REPO/dashboard" 2>/dev/null || true)"
  if [ -n "$inline_hits" ]; then
    echo "error: inline style attributes found; use DS classes/tokens instead" >&2
    echo "$inline_hits" | head -30 >&2
    exit 1
  fi
fi

echo "verification=pass design_system"
