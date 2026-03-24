# Task: Fix Packaged Launch Gateway and Setup Persistence

status: "in_progress"
priority: high
owner: CD
owner_agent: CD
agent_type: codex
created: 2026-03-23
updated_at: 2026-03-23T17:35:00Z

## Summary
Fix the packaged Aegilume shell so it does not rerun setup on every launch and can connect to the already-running local gateway instead of staying in a reconnect loop.

## Next Step
Patch startup ordering and reuse the existing OpenClaw gateway identity/device-auth state, then verify the packaged launch path with focused tests and direct app logs.

## Activity Log
- 2026-03-23: Confirmed `~/.openclaw-shell/setup.json` exists, so repeated onboarding is not a persistence-write failure.
- 2026-03-23: Confirmed renderer calls `setup:check` before IPC registration completes, causing setup fallback to `false` on startup.
- 2026-03-23: Confirmed the gateway server is actually listening on `127.0.0.1:18789`, but the shell loops on `4008 connect failed`.
- 2026-03-23: Confirmed shell device auth is stored under `~/.openclaw-shell`, while a valid paired OpenClaw identity/token already exists under `~/.openclaw/identity`.
