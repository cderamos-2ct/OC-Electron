# Command Center Phase 1 Spec

## Goal
Define the first actually-valuable dashboard screen before any deeper integrations or fancy debugging views.

This phase should answer, fast:
- what is CD doing right now?
- what changed recently?
- what is blocked?
- what needs Christian?

## Primary screen: Operator Overview

### 1) Now card
Show:
- current active work summary
- current focus lanes
- timestamp of last meaningful update

Backed by:
- `STATUS.md` (`Now`, `Current Focus`)

Why it matters:
Christian should know the current state in one glance without reading a transcript.

### 2) Blockers / Need card
Show:
- explicit blockers
- approvals needed
- risky decisions waiting on Christian
- “nothing needed” when clear

Backed by:
- `TASKS.md` blocked section
- `STATUS.md` waiting/next sections
- future approval state

Why it matters:
This is the "do I need to intervene or not" answer.

### 3) Active work card
Show:
- running work items
- a short note for each when helpful
- status chips like `running`, `queued`, `blocked`

Backed by:
- `TASKS.md`

Why it matters:
Makes active work legible without turning the dashboard into a wall of text.

### 4) Recent completions card
Show:
- condensed recent wins / completed chunks
- newest first
- ideally 3–8 items, not a full history dump

### Validation items now in play
- mobile screenshot/image attach flow in assistant chat
- explicit visual separation between heartbeat/proactive system updates and normal functional chat
- public dashboard mobile chat layout fixes in the real Next.js dashboard repo (composer visibility above dock and width adaptation on iPhone)

Backed by:
- `STATUS.md` (`Last Completed`)

Why it matters:
Shows forward motion and keeps Christian from wondering whether anything is happening.

### 5) Decision queue card
Show:
- queued decisions that are not urgent but still unresolved
- each with a one-line tradeoff summary where possible

Examples from current state:
- re-enable Control UI device auth
- keep Telegram groups blocked vs allowlist them
- decide later whether home folders become symlinks

Backed by:
- `TASKS.md` queued section
- supporting docs like `CONFIG_HARDENING_NOTES.md` and `TELEGRAM_GROUP_POLICY_OPTIONS.md`

Why it matters:
Separates "needs attention eventually" from "blocked right now".

## Interaction rules

### Keep it high-signal
- no raw logs on the first screen
- no giant tables
- no transcript dump by default
- no more than 5 primary cards on the landing view

### Prefer summaries over internals
Bad:
- websocket status noise
- provider implementation details
- long config JSON blobs

Good:
- "Dashboard hardening still pending"
- "Telegram groups intentionally blocked by config"
- "Documents migration plan ready; not applied"

### Drill-downs should exist, but not dominate
Each card can later link to deeper views:
- active work → task detail
- blockers → approvals / decisions
- completions → recent activity log
- decision queue → decision memo / config doc

## Current backing docs already available
- `STATUS.md`
- `TASKS.md`
- `CONFIG_HARDENING_NOTES.md`
- `TELEGRAM_GROUP_POLICY_OPTIONS.md`
- `ECOSYSTEM_INTEGRATION_MAP.md`
- `COMMAND_CENTER_BUILD_ORDER.md`

## Practical build note
Phase 1 can be built almost entirely from durable workspace docs before any serious provider integration work.

That is good.
It means the first useful dashboard can ship from local truth sources instead of waiting on every external integration to be perfect.
