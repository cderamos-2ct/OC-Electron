# Task: VIS-144 Agent tab selection should switch chat sessions or show explicit reply attribution

status: "in_progress"
title: "VIS-144 Agent tab selection should switch chat sessions or show explicit reply attribution"
priority: high
owner: VIS-144
owner_agent: CD
agent_type: codex
created: 2026-03-24T00:00:00Z
updated_at: 2026-03-24T00:00:00Z

## Summary
Fix openclaw-shell right-rail agent tab behavior so each tab maps to an explicit backend session target (or at least visible attribution is shown), while preventing silent transcript reuse across unrelated tab switches.

## Acceptance Criteria
- Selecting an agent tab updates composer targeting and displayed rail context.
- Tabs map to distinct backing session keys and do not reuse prior unrelated transcripts without indication.
- Sending messages from at least two tabs yields distinct routing or clearly labeled replies.

## Activity Log
- 2026-03-24T00:00:00Z: Task item created and implementation started for VIS-144.
