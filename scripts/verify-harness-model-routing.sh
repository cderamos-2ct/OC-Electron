#!/usr/bin/env bash
set -euo pipefail
# scripts/verify-harness-model-routing.sh
# PURPOSE: Validate deterministic model-routing policy anchors.
# USAGE: bash scripts/verify-harness-model-routing.sh

POLICY=".harness/model-routing-policy.json"

if [ ! -f "$POLICY" ]; then
  echo "error: missing $POLICY" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required to validate $POLICY" >&2
  exit 1
fi

jq -e . "$POLICY" >/dev/null 2>&1 || {
  echo "error: invalid JSON in $POLICY" >&2
  exit 1
}

for path in \
  '.roles.executor.primary.model' \
  '.roles.executor.escalation.model' \
  '.roles.architect.primary.model' \
  '.roles.architect.secondary.model' \
  '.roles.verifier.primary.model' \
  '.consensus.arbiter' \
  '.consensus.requiredVotes' \
  '.consensus.passCriteria.ciStatus'; do
  jq -e "$path" "$POLICY" >/dev/null 2>&1 || {
    echo "error: missing required key $path in $POLICY" >&2
    exit 1
  }
done

echo "verification=pass model_routing"
