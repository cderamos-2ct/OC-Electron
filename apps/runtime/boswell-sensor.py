#!/usr/bin/env python3
"""
Boswell Activity Sensor — macOS Active Window Tracker

Polls the active application and window title every 30 seconds,
writes structured events to boswell-activity-stream.jsonl.

Detects:
- App switches (new app in focus)
- Window title changes (new document/file/tab)
- Idle periods (screensaver, lock screen)
- Focus sessions (sustained time in one app)

Usage:
  python3 boswell-sensor.py              # Run in foreground
  python3 boswell-sensor.py --daemon     # Run as background daemon
  python3 boswell-sensor.py --status     # Show current tracking status
"""

import json
import os
import re
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Paths
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
STREAM_FILE = REPO_ROOT / ".antigravity" / "runtime" / "boswell-activity-stream.jsonl"
PID_FILE = REPO_ROOT / ".antigravity" / "runtime" / "boswell-sensor.pid"
STATE_FILE = REPO_ROOT / ".antigravity" / "runtime" / "boswell-sensor-state.json"

POLL_INTERVAL = 30  # seconds
IDLE_THRESHOLD = 300  # 5 minutes of same state = idle detection
FOCUS_SESSION_THRESHOLD = 600  # 10 minutes in same app = focus session


def get_active_window():
    """Get the currently active application and window title on macOS.

    Uses NSWorkspace (via Python bridge) as primary method — fast, no
    accessibility permissions needed. Falls back to lsappinfo, then osascript.
    """
    app_name = "Unknown"
    window_title = "No Window"

    # Method 1: lsappinfo (fast, no permissions needed)
    try:
        front = subprocess.run(
            ["lsappinfo", "front"],
            capture_output=True, text=True, timeout=3
        )
        asn = front.stdout.strip()
        if front.returncode == 0 and asn:
            info = subprocess.run(
                ["lsappinfo", "info", "-only", "name", asn],
                capture_output=True, text=True, timeout=3
            )
            if info.returncode == 0:
                match = re.search(r'"(?:name|LSDisplayName)"\s*=\s*"(.+?)"', info.stdout)
                if match:
                    app_name = match.group(1)
    except Exception:
        pass

    # Method 2: osascript for window title (needs accessibility)
    if app_name != "Unknown":
        try:
            title_script = f'''
            tell application "System Events"
                tell process "{app_name}"
                    try
                        return name of front window
                    on error
                        return "No Window"
                    end try
                end tell
            end tell
            '''
            title_result = subprocess.run(
                ["osascript", "-e", title_script],
                capture_output=True, text=True, timeout=3
            )
            if title_result.returncode == 0 and title_result.stdout.strip():
                window_title = title_result.stdout.strip()
        except Exception:
            pass  # Window title is nice-to-have, app name is sufficient

    # Fallback: osascript for both (if lsappinfo failed)
    if app_name == "Unknown":
        try:
            app_script = '''
            tell application "System Events"
                set frontApp to first application process whose frontmost is true
                return name of frontApp
            end tell
            '''
            app_result = subprocess.run(
                ["osascript", "-e", app_script],
                capture_output=True, text=True, timeout=3
            )
            if app_result.returncode == 0:
                app_name = app_result.stdout.strip()
        except Exception:
            pass

    return app_name, window_title


def detect_screen_state():
    """Detect if screen is locked or screensaver is active."""
    try:
        result = subprocess.run(
            ["python3", "-c",
             "import Quartz; print(Quartz.CGSessionCopyCurrentDictionary())"],
            capture_output=True, text=True, timeout=5
        )
        output = result.stdout
        if "CGSSessionScreenIsLocked" in output and "1" in output.split("CGSSessionScreenIsLocked")[1][:20]:
            return "locked"
    except Exception:
        pass

    try:
        result = subprocess.run(
            ["pgrep", "-x", "ScreenSaverEngine"],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode == 0:
            return "screensaver"
    except Exception:
        pass

    return "active"


def classify_activity(app_name, window_title):
    """Classify the current activity into a category."""
    app_lower = app_name.lower()
    title_lower = window_title.lower() if window_title else ""

    # IDE / Code
    if any(x in app_lower for x in ["cursor", "code", "xcode", "intellij", "pycharm", "vim", "neovim", "terminal", "iterm", "warp"]):
        if "terminal" in app_lower or "iterm" in app_lower or "warp" in app_lower:
            if "claude" in title_lower:
                return "ai-coding"
            return "terminal"
        return "coding"

    # AI tools
    if any(x in app_lower for x in ["claude", "chatgpt", "copilot"]):
        return "ai-interaction"

    # Communication
    if any(x in app_lower for x in ["mail", "outlook", "gmail"]):
        return "email"
    if any(x in app_lower for x in ["messages", "imessage", "slack", "teams", "discord", "telegram", "whatsapp"]):
        return "messaging"
    if any(x in app_lower for x in ["zoom", "meet", "facetime", "mightycall"]):
        return "meeting"

    # Productivity
    if any(x in app_lower for x in ["notion", "obsidian", "notes", "bear", "keep"]):
        return "notes"
    if any(x in app_lower for x in ["calendar", "fantastical"]):
        return "calendar"
    if any(x in app_lower for x in ["trello", "linear", "jira", "asana"]):
        return "project-management"

    # Documents
    if any(x in app_lower for x in ["docs", "sheets", "slides", "word", "excel", "powerpoint", "pages", "numbers", "keynote"]):
        return "documents"
    if any(x in app_lower for x in ["figma", "sketch", "canva"]):
        return "design"

    # Browser
    if any(x in app_lower for x in ["safari", "chrome", "firefox", "arc", "brave", "edge"]):
        if any(x in title_lower for x in ["github", "gitlab", "bitbucket"]):
            return "code-review"
        if any(x in title_lower for x in ["gmail", "outlook", "mail"]):
            return "email"
        if any(x in title_lower for x in ["slack", "teams", "discord"]):
            return "messaging"
        if any(x in title_lower for x in ["docs.google", "notion", "confluence"]):
            return "documents"
        return "browsing"

    # Finance
    if any(x in app_lower for x in ["quickbooks", "xero", "mint", "banking"]):
        return "finance"

    # Media / Break
    if any(x in app_lower for x in ["spotify", "music", "youtube", "netflix", "tv"]):
        return "media"

    return "other"


def log_event(event):
    """Append an event to the activity stream."""
    STREAM_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STREAM_FILE, "a") as f:
        f.write(json.dumps(event) + "\n")


def save_state(state):
    """Save sensor state for resumption."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def load_state():
    """Load previous sensor state."""
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {
        "last_app": None,
        "last_title": None,
        "last_category": None,
        "session_start": None,
        "screen_state": "active",
        "total_events": 0,
        "started_at": None
    }


def run_sensor():
    """Main sensor loop."""
    state = load_state()
    state["started_at"] = datetime.now(timezone.utc).isoformat()

    # Write PID file
    PID_FILE.parent.mkdir(parents=True, exist_ok=True)
    PID_FILE.write_text(str(os.getpid()))

    print(f"Boswell sensor started (PID {os.getpid()})")
    print(f"Logging to: {STREAM_FILE}")
    print(f"Poll interval: {POLL_INTERVAL}s")

    def shutdown(signum, frame):
        print("\nBoswell sensor shutting down...")
        if state.get("last_app") and state.get("session_start"):
            duration = (datetime.now(timezone.utc) - datetime.fromisoformat(state["session_start"])).total_seconds()
            log_event({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event_type": "session_end",
                "app": state["last_app"],
                "category": state.get("last_category", "unknown"),
                "duration_seconds": round(duration),
                "reason": "sensor_shutdown"
            })
        log_event({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": "sensor_stop",
            "total_events": state["total_events"]
        })
        save_state(state)
        PID_FILE.unlink(missing_ok=True)
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    # Log startup
    log_event({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": "sensor_start",
        "pid": os.getpid()
    })

    while True:
        try:
            now = datetime.now(timezone.utc)
            screen = detect_screen_state()

            if screen != "active":
                if state["screen_state"] == "active":
                    # Just went idle
                    log_event({
                        "timestamp": now.isoformat(),
                        "event_type": "idle_start",
                        "reason": screen
                    })
                    if state.get("last_app") and state.get("session_start"):
                        duration = (now - datetime.fromisoformat(state["session_start"])).total_seconds()
                        log_event({
                            "timestamp": now.isoformat(),
                            "event_type": "session_end",
                            "app": state["last_app"],
                            "category": state.get("last_category", "unknown"),
                            "duration_seconds": round(duration),
                            "reason": "idle"
                        })
                    state["screen_state"] = screen
                    state["total_events"] += 1
                    save_state(state)
                time.sleep(POLL_INTERVAL)
                continue

            if state["screen_state"] != "active":
                # Just came back
                log_event({
                    "timestamp": now.isoformat(),
                    "event_type": "idle_end",
                    "was": state["screen_state"]
                })
                state["screen_state"] = "active"
                state["last_app"] = None
                state["session_start"] = None
                state["total_events"] += 1

            app_name, window_title = get_active_window()
            category = classify_activity(app_name, window_title)

            # Detect app switch
            if app_name != state.get("last_app"):
                # End previous session
                if state.get("last_app") and state.get("session_start"):
                    duration = (now - datetime.fromisoformat(state["session_start"])).total_seconds()
                    log_event({
                        "timestamp": now.isoformat(),
                        "event_type": "session_end",
                        "app": state["last_app"],
                        "category": state.get("last_category", "unknown"),
                        "duration_seconds": round(duration),
                        "reason": "app_switch"
                    })

                # Start new session
                log_event({
                    "timestamp": now.isoformat(),
                    "event_type": "app_switch",
                    "app": app_name,
                    "window_title": window_title,
                    "category": category,
                    "previous_app": state.get("last_app")
                })
                state["last_app"] = app_name
                state["last_title"] = window_title
                state["last_category"] = category
                state["session_start"] = now.isoformat()
                state["total_events"] += 1

            # Detect window title change (same app, different document/tab)
            elif window_title != state.get("last_title"):
                log_event({
                    "timestamp": now.isoformat(),
                    "event_type": "title_change",
                    "app": app_name,
                    "window_title": window_title,
                    "previous_title": state.get("last_title"),
                    "category": category
                })
                state["last_title"] = window_title
                state["last_category"] = category
                state["total_events"] += 1

            # Detect focus session milestone
            if state.get("session_start"):
                session_duration = (now - datetime.fromisoformat(state["session_start"])).total_seconds()
                if session_duration >= FOCUS_SESSION_THRESHOLD and session_duration < FOCUS_SESSION_THRESHOLD + POLL_INTERVAL:
                    log_event({
                        "timestamp": now.isoformat(),
                        "event_type": "focus_session",
                        "app": app_name,
                        "category": category,
                        "duration_seconds": round(session_duration),
                        "narrative_weight": "high"
                    })
                    state["total_events"] += 1

            save_state(state)
            time.sleep(POLL_INTERVAL)

        except Exception as e:
            log_event({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event_type": "sensor_error",
                "error": str(e)
            })
            time.sleep(POLL_INTERVAL)


def show_status():
    """Show current sensor status."""
    if not PID_FILE.exists():
        print("Boswell sensor: NOT RUNNING")
        return

    pid = int(PID_FILE.read_text().strip())
    try:
        os.kill(pid, 0)
        print(f"Boswell sensor: RUNNING (PID {pid})")
    except ProcessLookupError:
        print(f"Boswell sensor: STALE PID ({pid}), not running")
        PID_FILE.unlink(missing_ok=True)
        return

    if STATE_FILE.exists():
        state = json.loads(STATE_FILE.read_text())
        print(f"  Current app: {state.get('last_app', 'unknown')}")
        print(f"  Category: {state.get('last_category', 'unknown')}")
        print(f"  Events logged: {state.get('total_events', 0)}")
        print(f"  Started: {state.get('started_at', 'unknown')}")

    if STREAM_FILE.exists():
        line_count = sum(1 for _ in open(STREAM_FILE))
        size_kb = STREAM_FILE.stat().st_size / 1024
        print(f"  Stream: {line_count} events ({size_kb:.1f} KB)")


if __name__ == "__main__":
    if "--status" in sys.argv:
        show_status()
    elif "--daemon" in sys.argv:
        # Daemonize
        if os.fork() > 0:
            sys.exit(0)
        os.setsid()
        if os.fork() > 0:
            sys.exit(0)
        sys.stdout = open(os.devnull, "w")
        sys.stderr = open(os.devnull, "w")
        run_sensor()
    else:
        run_sensor()
