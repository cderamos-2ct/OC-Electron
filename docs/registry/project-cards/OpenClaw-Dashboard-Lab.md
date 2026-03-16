# OpenClaw Dashboard Lab (Retired)

## Identity
- **Project:** OpenClaw public dashboard shell / dashboard-lab
- **Historical path:** `/Volumes/Storage/DOCKER/openclaw-dashboard-lab/openclaw-dashboard`
- **Public surface:** `https://cd.visualgraphx.com`
- **Repo origin:** `https://github.com/actionagentai/openclaw-dashboard.git`
- **Current branch observed:** `crd/dashboard-ui-ux-pass`

## What it is
This was a standalone dashboard worktree used during the command-chat/control-ui push.

It is **not** the canonical dashboard implementation root anymore. The active tree is `/Volumes/Storage/OpenClaw/dashboard`.

## Current architecture read
- Next.js app
- shell server via `server.cjs`
- mounted control-ui pattern
- builder/lobsterboard/control-ui surfaces in-repo
- gateway client logic in `lib/gateway-client.ts`
- shell and nav/layout logic in components such as `AppShell.tsx`

## Why it matters
Keep this only as historical branch/worktree context. Do not use it as the default target for:
- status checks
- new dashboard implementation
- launch/service wiring
- task-ledger source-of-truth decisions

## Current known issues
- public shell can load while mounted control/backend paths return `502`
- UI/UX quality needs focused improvement on mobile
- branch/worktree was already dirty with significant in-progress work
- project was previously being mentally conflated with the canonical dashboard tree

## Immediate next mapping/implementation steps
- if needed, mine historical diffs for unported ideas
- otherwise prefer `/Volumes/Storage/OpenClaw/dashboard` for all active work
