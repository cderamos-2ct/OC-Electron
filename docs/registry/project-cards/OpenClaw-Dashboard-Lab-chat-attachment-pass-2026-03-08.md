# OpenClaw Dashboard Lab Chat Attachment Pass — 2026-03-08

## Scope
First public-chat attachment pass in the real Next.js dashboard repo behind `cd.visualgraphx.com`.

## Repo
- `/Volumes/Storage/DOCKER/openclaw-dashboard-lab/openclaw-dashboard`

## Changes landed
- added attach button to the real public chat input
- added local attachment state in chat
- added removable attachment chip
- added image preview for attached screenshots/images
- injected attachment context into outgoing chat messages instead of remaining text-only

## Files touched
- `app/chat/page.tsx`

## Why this matters
This is the first real step toward fixing the blocker where Christian could not send screenshots/files through the public dashboard chat at all.

## Still missing / next work
- deeper image handling beyond local preview + text injection
- heartbeat/proactive treatment in the real public chat
- validation that attachments work cleanly on iPhone/PWA in live use
