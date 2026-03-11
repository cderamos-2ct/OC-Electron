# OpenClaw Orchestrator Overlay

This directory is the repo-local source of truth for orchestration state.

Goals:
- Keep task, routing, and consensus artifacts in the repository.
- Let OpenClaw act as the runtime, not the only state store.
- Make autonomous runs resumable after gateway or session restarts.

Core files:
- `AGENTS.md`: orchestration-specific bootstrap guidance for OpenClaw sessions
- `TOOLS.md`: expected tool usage and discipline for orchestrator runs
- `TASK_STATUS.md`: human-readable task board
- `run-state.json`: current autonomy loop and stop-reason state
- `task-quality-gates.jsonl`: append-only quality gate ledger
- `tasks/tasks.json`: machine-readable task ledger
- `rules/model-routing-policy.json`: role routing and consensus policy
- `agent-team/roles.yaml`: team and role ownership map

This overlay is intentionally additive. It does not replace the existing
application code or server state under `data/`.
