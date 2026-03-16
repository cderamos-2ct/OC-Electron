#!/usr/bin/env python3
"""
Boswell Quick Capture — Zero-Friction Thought Capture

Three capture modes:
1. CLI:     python3 boswell-capture.py "thought goes here"
2. Stdin:   echo "thought" | python3 boswell-capture.py
3. Interactive: python3 boswell-capture.py  (prompts for input)

Captures are written to boswell-captures.jsonl and optionally
dispatched to a target agent if tagged.

Tags:
  @agent   — Route to specific agent (e.g., @marcus "check Q1 numbers")
  #tag     — Categorize the capture (e.g., #idea, #todo, #decision)
  !priority — Mark as high priority

Usage:
  python3 boswell-capture.py "Remember to call Kyle about the contract"
  python3 boswell-capture.py "@marcus Check the Buckner invoice #finance"
  python3 boswell-capture.py "@karoline Draft reply to Lynn !priority"
  python3 boswell-capture.py  # interactive mode
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CAPTURES_FILE = REPO_ROOT / ".antigravity" / "runtime" / "boswell-captures.jsonl"
DISPATCH_DIR = REPO_ROOT / ".antigravity" / "runtime" / "dispatches"

VALID_AGENTS = [
    "cd", "karoline", "iris", "hermes", "vesta", "marcus",
    "ada", "kronos", "argus", "vulcan", "hypatia", "socrates",
    "themis", "boswell"
]


def parse_capture(text):
    """Parse a capture string for agents, tags, and priority."""
    agents = re.findall(r"@(\w+)", text)
    tags = re.findall(r"#(\w+)", text)
    priority = "!" in text or "!priority" in text.lower()

    # Clean the text of directives
    clean = text
    clean = re.sub(r"@\w+\s*", "", clean)
    clean = re.sub(r"#\w+\s*", "", clean)
    clean = re.sub(r"!priority\s*", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"!\s*", "", clean)
    clean = clean.strip()

    # Validate agents
    valid = [a for a in agents if a in VALID_AGENTS]
    invalid = [a for a in agents if a not in VALID_AGENTS]

    return {
        "text": clean,
        "raw": text,
        "target_agents": valid,
        "invalid_agents": invalid,
        "tags": tags,
        "priority": priority
    }


def create_dispatch(agent_id, capture):
    """Create a dispatch file for the target agent."""
    agent_dir = DISPATCH_DIR / agent_id
    agent_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    priority = "P1" if capture["priority"] else "P3"
    filename = f"{timestamp}-{priority}-capture.json"

    dispatch = {
        "id": f"CAP-{timestamp}",
        "from": "boswell",
        "to": agent_id,
        "priority": priority,
        "type": "quick_capture",
        "subject": capture["text"][:80],
        "body": capture["text"],
        "tags": capture["tags"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "boswell-capture",
        "status": "pending"
    }

    filepath = agent_dir / filename
    with open(filepath, "w") as f:
        json.dump(dispatch, f, indent=2)

    return filepath


def log_capture(capture):
    """Log the capture to the captures file."""
    CAPTURES_FILE.parent.mkdir(parents=True, exist_ok=True)

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "text": capture["text"],
        "raw": capture["raw"],
        "target_agents": capture["target_agents"],
        "tags": capture["tags"],
        "priority": capture["priority"],
        "dispatched_to": capture["target_agents"] if capture["target_agents"] else None
    }

    with open(CAPTURES_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")

    return entry


def main():
    # Get input from args, stdin, or interactive
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
    elif not sys.stdin.isatty():
        text = sys.stdin.read().strip()
    else:
        print("Boswell Quick Capture")
        print("  @agent to route | #tag to categorize | !priority for urgent")
        print("  Type your thought, then press Enter.\n")
        try:
            text = input("📜 > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nCapture cancelled.")
            return

    if not text:
        print("Nothing to capture.")
        return

    # Parse
    capture = parse_capture(text)

    # Warn about invalid agents
    if capture["invalid_agents"]:
        print(f"⚠ Unknown agent(s): {', '.join(capture['invalid_agents'])} (ignored)")

    # Log
    entry = log_capture(capture)

    # Dispatch if agents targeted
    dispatched = []
    for agent_id in capture["target_agents"]:
        filepath = create_dispatch(agent_id, capture)
        dispatched.append((agent_id, filepath))

    # Output
    priority_mark = " ❗" if capture["priority"] else ""
    print(f"📜 Captured{priority_mark}: {capture['text']}")

    if capture["tags"]:
        print(f"   Tags: {', '.join('#' + t for t in capture['tags'])}")

    if dispatched:
        for agent_id, fp in dispatched:
            print(f"   → Dispatched to {agent_id}")

    if not dispatched and not capture["tags"]:
        print("   (Logged to Boswell's stream — no dispatch target)")


if __name__ == "__main__":
    main()
