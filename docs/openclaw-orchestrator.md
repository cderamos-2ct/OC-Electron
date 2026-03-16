# OpenClaw Orchestrator Phase 1

This repo now includes a plugin-first orchestration scaffold intended to map
the `dev-harness-core` model onto OpenClaw without forking OpenClaw core.

## What Exists

- Repo-local overlay in `.antigravity/`
- Standalone plugin package in `packages/openclaw-orchestrator/`
- Hook pack for bootstrap and lifecycle state writes
- Optional tools for task state, routing, and consensus checks

## Why This Shape

OpenClaw already provides:
- runtime sessions and subagents
- model overrides
- plugins and hooks
- cron and heartbeat automation

What it does not provide natively is a repo-local task ledger, vote ledger, or
consensus policy engine. This scaffold supplies that layer.

## Expected Install Flow

From the `packages/openclaw-orchestrator/` directory:

```bash
openclaw plugins install .
openclaw hooks install .
```

Then enable the tools and hooks in OpenClaw config:

```json5
{
  tools: {
    allow: ["openclaw-orchestrator"]
  },
  hooks: {
    enabled: ["orchestrator-bootstrap-overlay", "orchestrator-session-state"]
  }
}
```

## Phase 1 Scope

Phase 1 is intentionally narrow:
- durable repo-local artifacts
- role routing lookup
- task claim/update/list operations
- consensus evaluation
- lifecycle hook writes

It does not yet add:
- autonomous run scheduling
- automatic subagent fan-out
- CI integration
- a richer UI over the overlay

Those are Phase 2 items once this artifact shape proves useful.
