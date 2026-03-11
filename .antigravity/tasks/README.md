# Task System

Canonical task state lives in individual task files under `.antigravity/tasks/items/`.

Do not treat chat history, `TASKS.md`, or `TASK_STATUS.md` as authoritative task state.

## Source of truth

- Canonical: `.antigravity/tasks/items/<TASK-ID>.md`
- Generated human board: `.antigravity/TASKS.md`
- Generated active summary: `.antigravity/TASK_STATUS.md`
- Generated machine index: `.antigravity/tasks/index.json`
- Generated compatibility mirror: `.antigravity/tasks/tasks.json`

## Required agent workflow

1. Create or claim a task file before substantive work.
2. Set `owner_agent`, `agent_type`, `status`, and `updated_at`.
3. Append progress to the task file `## Activity Log`.
4. Update `status` to `blocked`, `done`, or `failed` when work changes state.
5. Regenerate the derived board/index after task edits:

```bash
node /Volumes/Storage/OpenClaw/.antigravity/tasks/scripts/sync-task-board.mjs
```

## Task file format

Each task file is markdown with YAML frontmatter.

Required fields:

- `id`
- `title`
- `status`
- `priority`
- `owner_agent`
- `agent_type`
- `created_at`
- `updated_at`
- `source`

Optional fields:

- `depends_on`
- `blocked_by`
- `tags`
- `artifacts`

Body sections:

- `## Summary`
- `## Current State`
- `## Acceptance`
- `## Activity Log`
- `## Notes`

## Status vocabulary

- `queued`
- `in_progress`
- `blocked`
- `review`
- `done`
- `failed`
- `cancelled`

## Ownership model

- `CD` (orchestrator) creates, routes, reprioritizes, and closes tasks.
- Specialist agents claim tasks by setting `owner_agent` and `agent_type`.
- Multiple agents may append to `## Activity Log`, but only the current owner should rewrite status fields.
