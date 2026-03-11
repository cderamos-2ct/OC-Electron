# DEV_CONTROL_MAP.md

## Purpose
Define the local development-control surface on this Mac so CD can operate coding tools and project folders intentionally instead of guessing.

## Current reality snapshot

### Installed coding CLIs on PATH
- `claude` → `/Users/cderamos/.local/bin/claude`
- `git` → `/usr/bin/git`
- `codex` → not currently on PATH
- `opencode` → not currently on PATH
- `pi` → not currently on PATH

## Important path distinctions

### Runtime workspace
- `/Users/cderamos/.openclaw/workspace`
- This is where OpenClaw injects/editable workspace state for the current runtime session.

### Real OpenClaw home / project base
- `/Volumes/Storage/OpenClaw`
- This should be treated as the broader OpenClaw project/home folder.

### Antigravity path observed
- `/Volumes/Storage/antigravity`
- currently visible but sparse from this quick audit
- also observed: `/Users/cderamos/antigravity`
- needs a deeper pass before treating either as the canonical dev repo/root

## Current control implications

### Claude Code
Usable now.
Recommended mode:
- run in explicit target repo/folder only
- use `--print --permission-mode bypassPermissions`
- do not treat the runtime workspace as the default coding target unless explicitly intended

### Codex / OpenCode / Pi
Not usable by name right now because they are not currently on PATH.
Before claiming control over them, verify:
- whether they are installed elsewhere
- whether they just need PATH fixes
- whether they need auth/install/setup

## Safe operating rule
Before using any coding agent/tool, answer these first:
1. what is the real target project path?
2. is it a git repo?
3. is this the canonical repo or just runtime workspace state?
4. which tool is actually installed and available here?

## Next recommended audit
- identify the real antigravity repo/root and whether it is git-backed
- inventory the major project roots under `/Volumes/Storage`
- determine whether Codex exists somewhere off-PATH or is simply not installed
- add preferred build/test commands for each real project root
- decide which repos CD may operate in autonomously vs only with explicit instruction

## Working rule
Do not answer "yes, I control tool X/project Y" until the path, tool availability, and operating mode are verified in this map.
