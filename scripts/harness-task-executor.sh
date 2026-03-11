#!/usr/bin/env bash
set -euo pipefail
# scripts/harness-task-executor.sh
# PURPOSE: Default automation hook for autonomy-loop task execution.
# USAGE: bash scripts/harness-task-executor.sh <task-id>
# NOTE: Returns 0 only when task execution/verification succeeds.

TASK_ID="${1:-}"
if [ -z "$TASK_ID" ]; then
  echo "error: task id is required" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORCH="$REPO_ROOT/agents/orchestrate.sh"
TASKS_FILE="$REPO_ROOT/agents/state/tasks.json"

if [ ! -x "$ORCH" ]; then
  echo "error: missing orchestrator at $ORCH" >&2
  exit 1
fi
if [ ! -f "$TASKS_FILE" ]; then
  echo "error: missing tasks file at $TASKS_FILE" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required for task execution hook" >&2
  exit 1
fi

cd "$REPO_ROOT"

verify_cmd="$(jq -r ".taskGroups[].tasks[] | select(.id == \"$TASK_ID\") | .verifyCommand // \"\"" "$TASKS_FILE" | head -1)"
if [ -n "$verify_cmd" ] && [ "$verify_cmd" != "null" ]; then
  echo "[executor] task=$TASK_ID mode=verifyCommand"
  "$ORCH" verify run "$TASK_ID"
  exit $?
fi

task_exec_script="$REPO_ROOT/scripts/execute-task-${TASK_ID}.sh"
if [ -x "$task_exec_script" ]; then
  echo "[executor] task=$TASK_ID mode=taskScript path=scripts/execute-task-${TASK_ID}.sh"
  "$task_exec_script"
  exit $?
fi

if [ -x "$REPO_ROOT/scripts/execute-task.sh" ]; then
  echo "[executor] task=$TASK_ID mode=genericScript path=scripts/execute-task.sh"
  "$REPO_ROOT/scripts/execute-task.sh" "$TASK_ID"
  exit $?
fi

task_id_lower="$(printf "%s" "$TASK_ID" | tr '[:upper:]' '[:lower:]')"
shopt -s nullglob
verify_candidates=("$REPO_ROOT/scripts/verify-${task_id_lower}"*.sh)
shopt -u nullglob
if [ "${#verify_candidates[@]}" -gt 0 ]; then
  verify_script="${verify_candidates[0]}"
  echo "[executor] task=$TASK_ID mode=taskVerifyScript path=${verify_script#$REPO_ROOT/}"
  bash "$verify_script"
  exit $?
fi

verification_field="$(jq -r ".taskGroups[].tasks[] | select(.id == \"$TASK_ID\") | .verification // \"\"" "$TASKS_FILE" | head -1)"
inline_cmd="$(printf "%s" "$verification_field" | sed -n 's/.*`\([^`]*\)`.*/\1/p' | head -1)"
if [ -n "$inline_cmd" ]; then
  case "$inline_cmd" in
    bash\ *|npm\ *|pnpm\ *|yarn\ *|npx\ *|node\ *|pytest\ *|go\ *|make\ *|./*)
      echo "[executor] task=$TASK_ID mode=verificationInlineCommand"
      bash -lc "$inline_cmd"
      exit $?
      ;;
  esac
fi

echo "error: no automation path available for task $TASK_ID (missing verifyCommand/execute-task script)" >&2
exit 1
