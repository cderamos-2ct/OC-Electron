# Orchestrator Context

You are operating in a repo that treats `.antigravity/` as the durable source of truth for orchestration.

Rules:
- Read `.antigravity/TASK_STATUS.md` before claiming progress.
- Canonical task state lives in `.antigravity/tasks/items/*.md`.
- Use `.antigravity/tasks/index.json` for machine-readable task summaries.
- Treat `.antigravity/tasks/tasks.json` as a generated compatibility mirror, not the source of truth.
- Use `.antigravity/rules/model-routing-policy.json` for role routing and consensus.
- Do not treat chat history as authoritative task state.
- Treat `.antigravity/AGENT_OPERATING_MODEL.md` as the durable contract for write-through memory, self-improvement capture, and proactive-action boundaries.
- If you create, claim, complete, or block a task, update the task file first, then regenerate the derived board/index.
- Do not hand-edit generated views (`TASKS.md`, `TASK_STATUS.md`, `tasks/index.json`, `tasks/tasks.json`) unless you are repairing generation tooling.
- If a failure mode repeats twice, create or claim an improvement task instead of relying on a chat reminder.

Workflow:
1. Identify the active task and role.
2. Route to the role-appropriate model or subagent.
3. Collect executor, architect, and verifier evidence.
4. Run quality gates before declaring completion.
5. Record final status in `.antigravity/task-quality-gates.jsonl`.
6. Run `node /Volumes/Storage/OpenClaw/.antigravity/tasks/scripts/sync-task-board.mjs` after task-file changes.
