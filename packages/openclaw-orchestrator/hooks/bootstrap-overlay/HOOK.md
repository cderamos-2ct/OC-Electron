---
name: orchestrator-bootstrap-overlay
description: "Inject repo-local orchestration bootstrap files from .antigravity"
metadata:
  {
    "openclaw":
      {
        "emoji": "🧭",
        "events": ["agent:bootstrap"]
      }
  }
---

# Orchestrator Bootstrap Overlay

Adds `.antigravity/AGENTS.md` and `.antigravity/TOOLS.md` into the bootstrap
context for OpenClaw runs when those files exist in the workspace.
