# Agent Registry

This directory is the canonical org registry for dashboard cards, agent identity, and lane sync.

## Source of truth

Treat `.antigravity/agents/*.json` as the durable identity layer for every permanent agent.

Each agent file owns:
- stable `id`
- `lane`
- human-facing `name`
- `sessionLabel` for runtime routing
- `persistent` + `startupPolicy`
- `desiredStatus` for reconciliation
- `roleFile` for durable job duties
- `supervisor` / escalation chain
- dashboard-facing metadata such as `dashboardCardId`

## Dashboard contract

The dashboard should render agent cards from this registry first, then join runtime state from `.antigravity/runtime/sessions.json` and task ownership from `.antigravity/tasks/index.json`.

That means the dashboard shows:
- who should exist (registry)
- who is alive right now (runtime)
- what each agent is doing (tasks)

Do **not** infer durable agent identity from ephemeral sessions alone.

## Runtime sync contract

- Desired state lives in `.antigravity/agents/*.json`
- Observed runtime state lives in `.antigravity/runtime/sessions.json`
- Assignment state lives in `.antigravity/tasks/items/*.md`
- Generated task views live in `.antigravity/tasks/index.json`, `.antigravity/TASKS.md`, and `.antigravity/TASK_STATUS.md`

A reconciler should compare desired vs observed state and mark each agent as one of:
- `healthy`
- `missing`
- `orphaned`
- `drifted`
- `idle`
- `busy`

## Hiring rules

Permanent hires must:
1. get a new `agents/<id>.json` registry entry
2. get a role file at `agents/profiles/<id>/DIRECTIVES.md`
3. get a stable `sessionLabel`
4. declare `persistent`, `startupPolicy`, and `desiredStatus`
5. appear in runtime/task views after reconciliation

Temporary hires should use task/project-specific ids and should not replace permanent lane ids.
