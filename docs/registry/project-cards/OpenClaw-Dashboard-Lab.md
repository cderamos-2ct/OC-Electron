# OpenClaw Dashboard Lab

## Identity
- **Project:** OpenClaw public dashboard shell / dashboard-lab
- **Canonical path:** `/Volumes/Storage/DOCKER/openclaw-dashboard-lab/openclaw-dashboard`
- **Public surface:** `https://cd.visualgraphx.com`
- **Repo origin:** `https://github.com/actionagentai/openclaw-dashboard.git`
- **Current branch observed:** `crd/dashboard-ui-ux-pass`

## What it is
This is the real Next.js/React dashboard codebase behind the public `cd.visualgraphx.com` surface.

It is **not** the older Python/FastAPI command-center app under `/Volumes/Storage/OpenClaw`.

## Current architecture read
- Next.js app
- shell server via `server.cjs`
- mounted control-ui pattern
- builder/lobsterboard/control-ui surfaces in-repo
- gateway client logic in `lib/gateway-client.ts`
- shell and nav/layout logic in components such as `AppShell.tsx`

## Why it matters
This is the correct target for:
- mobile/iPhone UX fixes
- connection-state debugging for the public dashboard
- screenshot/chat UX on the public surface
- persistent digest integration on the dashboard users actually see

## Current known issues
- public shell can load while mounted control/backend paths return `502`
- UI/UX quality needs focused improvement on mobile
- branch is already dirty with significant in-progress work
- project was previously being mentally conflated with the older Python app

## Immediate next mapping/implementation steps
- inspect `server.cjs` for mounted control proxy behavior
- inspect `lib/gateway-client.ts` and related shell components for connection-state handling
- inspect chat/mobile surfaces in the real Next.js app before applying UX patches
- treat `/Volumes/Storage/OpenClaw` Python app as adjacent/legacy/supporting surface, not the main public dashboard target
