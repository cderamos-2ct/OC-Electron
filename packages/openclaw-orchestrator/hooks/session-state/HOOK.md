---
name: orchestrator-session-state
description: "Persist lightweight run-state updates into .antigravity/run-state.json"
metadata:
  {
    "openclaw":
      {
        "emoji": "📝",
        "events": ["command:new", "command:reset", "command:stop"]
      }
  }
---

# Orchestrator Session State

Writes session lifecycle events into `.antigravity/run-state.json` so autonomous
orchestration can resume from repository artifacts instead of chat history alone.
