# openclaw-orchestrator

Repo-local orchestration plugin for OpenClaw.

This package treats `.antigravity/` as the source of truth for:
- task state
- role routing
- consensus votes
- autonomy run state

## Install

From this directory:

```bash
openclaw plugins install .
openclaw hooks install .
```

## Enable Tools

Add the plugin to the tool allowlist:

```json5
{
  tools: {
    allow: ["openclaw-orchestrator"]
  }
}
```

## Enable Hooks

```bash
openclaw hooks enable orchestrator-bootstrap-overlay
openclaw hooks enable orchestrator-session-state
```

## Tools

- `orchestrator_status`
- `task_list`
- `task_claim`
- `task_update`
- `role_route`
- `consensus_check`

## Overlay Expectations

The plugin expects a repo-local `.antigravity/` directory. If missing, the
machine-readable JSON files are created automatically with conservative defaults.
