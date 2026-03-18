#!/usr/bin/env bash
set -euo pipefail
# scripts/verify-harness-autonomy-rules.sh
# PURPOSE: Validate project-level autonomy contract anchors.
# USAGE: bash scripts/verify-harness-autonomy-rules.sh
# OUTPUT: Prints verification=pass on success; exits non-zero on failure.

has_pattern() {
  local pattern="$1"
  local file="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -q "$pattern" "$file"
  else
    grep -Eq "$pattern" "$file"
  fi
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${OPENCLAW_DATA_DIR:-$REPO_ROOT/.antigravity}"

for file in \
  "$DATA_DIR/RULES.md" \
  "$DATA_DIR/AUTONOMY_CONTRACT.md" \
  "$DATA_DIR/VALIDATION_MATRIX.md"; do
  [ -f "$file" ] || { echo "error: missing required file: $file" >&2; exit 1; }
done

has_pattern "Full Autonomy Contract \\(Hard\\)" "$DATA_DIR/RULES.md" || { echo "error: RULES missing full autonomy section" >&2; exit 1; }
has_pattern "Approved Stop Conditions" "$DATA_DIR/AUTONOMY_CONTRACT.md" || { echo "error: AUTONOMY_CONTRACT missing stop conditions" >&2; exit 1; }
has_pattern "Full autonomy contract gate" "$DATA_DIR/VALIDATION_MATRIX.md" || { echo "error: VALIDATION_MATRIX missing autonomy gate" >&2; exit 1; }
echo "verification=pass"
