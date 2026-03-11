#!/usr/bin/env bash
set -euo pipefail
# scripts/verify-harness-agent-lifecycle-rules.sh
# PURPOSE: Validate project-level harness lifecycle and model-routing rule anchors.
# USAGE: bash scripts/verify-harness-agent-lifecycle-rules.sh
# OUTPUT: Prints verification=pass on success; exits non-zero with error details on failure.

has_pattern() {
  local pattern="$1"
  local file="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -q "$pattern" "$file"
  else
    grep -Eq "$pattern" "$file"
  fi
}

for file in \
  ".antigravity/RULES.md" \
  ".antigravity/PARALLELISM_RULES.md" \
  ".antigravity/EXECUTION_LOOP.md" \
  ".antigravity/VALIDATION_MATRIX.md" \
  ".antigravity/details/rules/agent-lifecycle-and-model-routing-policy.md"; do
  [ -f "$file" ] || { echo "error: missing required file: $file" >&2; exit 1; }
done

has_pattern "Agent Lifecycle \\+ Cap Discipline \\(Hard\\)" ".antigravity/RULES.md" || { echo "error: RULES missing lifecycle section" >&2; exit 1; }
has_pattern "Agent Lifecycle Barrier \\(Required\\)" ".antigravity/PARALLELISM_RULES.md" || { echo "error: PARALLELISM_RULES missing lifecycle barrier section" >&2; exit 1; }
has_pattern "Execute agent lifecycle barrier" ".antigravity/EXECUTION_LOOP.md" || { echo "error: EXECUTION_LOOP missing lifecycle step" >&2; exit 1; }
has_pattern "Agent lifecycle \\+ model-routing gate" ".antigravity/VALIDATION_MATRIX.md" || { echo "error: VALIDATION_MATRIX missing lifecycle/model-routing gate" >&2; exit 1; }
echo "verification=pass"
