# Parallelism Rules

## Hard Rule
Only run work in parallel when file ownership and side effects do not overlap.

## Agent Lifecycle Barrier (Required)
1. Record every spawned agent ID in loop-local state.
2. Before loop completion or additional spawns:
- `wait` for all active IDs.
- `close` every completed ID.
3. If any ID cannot be closed, mark task `blocked` and log an incident.
