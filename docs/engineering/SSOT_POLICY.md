# SSOT Policy Index

## Purpose

This file defines the source-of-truth order for the unified repo so humans and
agents stop guessing which file wins.

## Source-of-truth order

### Task state

1. `.antigravity/tasks/items/*.md`
2. `.antigravity/tasks/README.md`
3. generated task views (`TASKS.md`, `tasks/index.json`, `tasks/tasks.json`) are derived only

### Agent registry

1. `.antigravity/agents/*.json`
2. `.antigravity/agents/profiles/*/{SOUL,MEMORY,HEARTBEAT,DIRECTIVES}.md`
3. generated roster/org views

### Runtime workspace guidance

1. canonical source in `/Volumes/Storage/OpenClaw`
2. synced runtime-workspace copies are downstream execution views

The runtime workspace is never the SSOT for org structure or durable policy.

### Dashboard code

1. `dashboard/`
2. old external dashboard repo is historical only until retired

### Durable docs

1. `docs/`
2. runtime workspace copies or notes are temporary

### Service definitions

1. live launchd plist path under `~/Library/LaunchAgents/`
2. corresponding source/scripts in this repo
3. logs/state are evidence, not source of truth

## Non-SSOT examples

These may exist, but must not be treated as authoritative:

- `.antigravity/runtime/*.json`
- `.antigravity/evidence/*`
- `.openclaw/runtime-workspace/*`
- generated dashboard build output
- logs
- databases

Special note:

- `.antigravity/runtime/README.md` may describe the mirror, but the mirror files
  themselves are still non-SSOT and should not be treated as canonical state.

## Rule of resolution

When two places disagree:

1. prefer canonical source in this repo
2. prefer tracked policy/config over generated runtime output
3. prefer item-level task files over board summaries
4. prefer agent JSON + tracked profile docs over what a current session claims
