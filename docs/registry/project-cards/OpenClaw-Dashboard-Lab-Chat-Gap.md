# OpenClaw Dashboard Lab Chat Gap

## Purpose
Capture the current missing pieces in the real public chat surface at `/Volumes/Storage/DOCKER/openclaw-dashboard-lab/openclaw-dashboard/app/chat/page.tsx`.

## Confirmed current state
- chat supports:
  - text input
  - send
  - streaming responses
  - abort
  - session switching/history
- chat does **not yet** expose:
  - screenshot/image attach
  - file attach
  - upload preview
  - heartbeat/proactive visual distinction equivalent to the legacy Python app

## Why this matters
This is the biggest remaining blocker for remote UI/UX iteration because Christian still cannot reliably send screenshots/files through the real public dashboard chat.

## Files implicated
- `app/chat/page.tsx`
- `hooks/use-openclaw-chat.ts`
- likely a new upload path / API surface in the Next.js app

## Immediate next implementation goal
Create a real public-dashboard chat attachment flow for screenshots/files in the correct codebase, not just the legacy Python app.
