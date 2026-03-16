# OpenClaw Dashboard

## Identity
- **Project:** OpenClaw dashboard / command center
- **Canonical root:** `/Volumes/Storage/OpenClaw`
- **Canonical dashboard tree:** `/Volumes/Storage/OpenClaw/dashboard`
- **Runtime workspace:** `/Users/cderamos/.openclaw/workspace`

## Current architecture read
- FastAPI/Python app centered on `apps/runtime/server.py`
- lightweight frontend in `dashboard/`
- scripts-based operator integrations in `scripts/`
- repo-local orchestration overlay in `packages/openclaw-orchestrator/`

## Recent implementation move
- screenshot/image attach path for chat improved in the frontend/backend
- heartbeat/proactive messages now have an explicit visual separation lane in the chat UI instead of blending into normal assistant responses
- persistent daily digest wiring has started:
  - backend `/api/daily-digest` endpoint added on top of existing briefing data
  - frontend preload/seed path switched toward digest consumption
  - Morning Brief panel now has partial richer digest rendering for prep/follow-ups and link-aware calendar/task rows

## Current UX problem framing
The dashboard already had upload/document infrastructure, but the chat UX was document-centric and not mobile screenshot-first.
The heartbeat/proactive updates also visually blended too much with normal functional chat.

## Next mapping/implementation steps
- validate mobile upload flow live
- verify screenshots are attachable from iPhone dashboard
- confirm whether image-only context is enough or whether deeper vision support is needed in the assistant path
- continue iPhone-specific layout/interaction cleanup

## Centralization Note
The older dashboard-lab repo under `/Volumes/Storage/DOCKER/openclaw-dashboard-lab/openclaw-dashboard` is retired from active workflow. Use `/Volumes/Storage/OpenClaw/dashboard` as the only source of truth for implementation, status checks, and future app bring-up.
