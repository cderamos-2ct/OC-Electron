#!/usr/bin/env bash
set -euo pipefail
# scripts/verify-harness-lint-stack.sh
# PURPOSE: Enforce presence of project lint-stack policy required by harness gates.
# USAGE: bash scripts/verify-harness-lint-stack.sh
# OUTPUT: Prints verification=pass when lint policy exists; non-zero on missing file.
if [ ! -f ".harness/lint-policy.json" ]; then
  echo "error: missing .harness/lint-policy.json" >&2
  exit 1
fi
echo "verification=pass"
