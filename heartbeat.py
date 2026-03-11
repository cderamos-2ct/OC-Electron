#!/usr/bin/env python3
"""
AntiGravity Heartbeat — Proactive agent loop.

Every cycle: reads HEARTBEAT.md, runs Claude with full Mac tool access,
and if something needs attention POSTs it to the dashboard server
(which broadcasts it to all connected browsers as a toast notification).

No Telegram required. Accessible via the Cloudflare tunnel PWA.
"""

import os
import sys
import json
import re
import sqlite3
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from runtime_directives import process_runtime_directives

try:
    import urllib.request
    import urllib.error
except ImportError:
    pass

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

CLAUDE_CLI   = os.getenv("CLAUDE_CLI_PATH", "claude")
CLAUDE_MODEL = os.getenv("HEARTBEAT_MODEL", os.getenv("CLAUDE_MODEL", "haiku"))
AGENT_NAME   = os.getenv("AGENT_NAME", "AntiGravity")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "http://localhost:8420")

BASE_DIR     = Path(__file__).resolve().parent
HEARTBEAT_MD = BASE_DIR / "HEARTBEAT.md"
STATE_FILE   = BASE_DIR / "data" / "heartbeat_state.json"
JOURNAL_DB   = BASE_DIR / "data" / "journal.db"
MEMORY_DB    = BASE_DIR / "data" / "memory.db"

# ── State ─────────────────────────────────────────────────────────────────────

def load_state():
    if STATE_FILE.exists():
        state = json.loads(STATE_FILE.read_text())
        state.setdefault("questions_asked_today", 0)
        state.setdefault("questions_date", None)
        state.setdefault("last_question_time", None)
        return state
    return {
        "last_run": None, "last_daily": None, "last_alerts": [],
        "questions_asked_today": 0, "questions_date": None, "last_question_time": None,
    }

def save_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def save_memory_sync(key: str, value: str):
    now = datetime.utcnow().isoformat()
    MEMORY_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(MEMORY_DB))
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS memory ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT,"
            "user_id INTEGER DEFAULT 0,"
            "key TEXT NOT NULL,"
            "value TEXT,"
            "created_at TEXT,"
            "updated_at TEXT)"
        )
        row = conn.execute(
            "SELECT id FROM memory WHERE user_id=? AND key=?",
            (0, key),
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE memory SET value=?, updated_at=? WHERE id=?",
                (value, now, row[0]),
            )
        else:
            conn.execute(
                "INSERT INTO memory (user_id,key,value,created_at,updated_at) VALUES (?,?,?,?,?)",
                (0, key, value, now, now),
            )
        conn.commit()
    finally:
        conn.close()

# ── Dashboard Push ────────────────────────────────────────────────────────────

def push_to_dashboard(message: str, urgency: str = "normal"):
    """POST a proactive message to the running dashboard server (appears in chat feed)."""
    payload = json.dumps({
        "message": message,
        "urgency": urgency,
    }).encode()

    try:
        req = urllib.request.Request(
            f"{DASHBOARD_URL}/api/proactive-message",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            ok = result.get("ok", False)
            print(f"  → Pushed to dashboard chat (ok={ok})")
    except urllib.error.URLError as e:
        print(f"  → Dashboard unreachable ({e.reason})")
    except Exception as e:
        print(f"  → Push failed: {e}")

# ── Data helpers ──────────────────────────────────────────────────────────────

def get_journal_entries(since_hours: int = 24):
    try:
        if not JOURNAL_DB.exists():
            return []
        cutoff = (datetime.utcnow() - timedelta(hours=since_hours)).isoformat()
        conn = sqlite3.connect(str(JOURNAL_DB))
        cur = conn.execute(
            "SELECT timestamp, source, summary FROM activity_log "
            "WHERE timestamp > ? ORDER BY id DESC LIMIT 20",
            (cutoff,))
        rows = cur.fetchall()
        conn.close()
        return [{"time": r[0][:16], "source": r[1], "summary": r[2]} for r in rows]
    except Exception:
        return []

def get_new_journal_since(last_run):
    if not last_run:
        return []
    try:
        if not JOURNAL_DB.exists():
            return []
        conn = sqlite3.connect(str(JOURNAL_DB))
        cur = conn.execute(
            "SELECT timestamp, source, summary FROM activity_log "
            "WHERE timestamp > ? ORDER BY id DESC LIMIT 10",
            (last_run,))
        rows = cur.fetchall()
        conn.close()
        return [{"time": r[0][:16], "source": r[1], "summary": r[2]} for r in rows]
    except Exception:
        return []

def get_memories():
    try:
        if not MEMORY_DB.exists():
            return []
        conn = sqlite3.connect(str(MEMORY_DB))
        cur = conn.execute(
            "SELECT key, value FROM memory ORDER BY updated_at DESC LIMIT 30")
        rows = cur.fetchall()
        conn.close()
        return [{"key": r[0], "value": r[1]} for r in rows]
    except Exception:
        return []

def get_new_teams_messages(since_ts):
    if not since_ts:
        return []
    try:
        ts = since_ts.replace("T", " ")[:19]
        scripts_dir = BASE_DIR / "scripts"
        result = subprocess.run(
            [str(scripts_dir / "get_teams_messages.sh"), "--since", ts, "30"],
            capture_output=True, text=True, timeout=15)
        output = result.stdout.strip()
        if not output or output == "TEAMS_NO_NEW":
            return []
        return output.split("\n")
    except Exception:
        return []

# ── Pre-meeting check ─────────────────────────────────────────────────────────

def check_upcoming_meetings(minutes_ahead: int = 15) -> list:
    """Returns list of meeting titles starting within minutes_ahead minutes."""
    scripts_dir = BASE_DIR / "scripts"
    google_helper = scripts_dir / "google_helper.py"
    try:
        result = subprocess.run(
            ["python3", "-W", "ignore", str(google_helper), "calendar_today", "1"],
            capture_output=True, text=True, timeout=15,
            env={**os.environ, "CLAUDECODE": "", "CLAUDE_CODE_ENTRYPOINT": ""}
        )
        output = result.stdout.strip()
        now = datetime.now()
        cutoff = now + timedelta(minutes=minutes_ahead)
        upcoming = []
        for line in output.split("\n"):
            # Look for time patterns like "2:30 PM" or "14:30"
            time_match = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)?', line, re.IGNORECASE)
            if time_match:
                hour = int(time_match.group(1))
                minute = int(time_match.group(2))
                ampm = time_match.group(3)
                if ampm and ampm.upper() == "PM" and hour != 12:
                    hour += 12
                elif ampm and ampm.upper() == "AM" and hour == 12:
                    hour = 0
                meeting_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                if now <= meeting_time <= cutoff:
                    upcoming.append(line.strip())
        return upcoming
    except Exception:
        return []

# ── Heartbeat prompt ──────────────────────────────────────────────────────────

def build_heartbeat_prompt(state: dict) -> str:
    now = datetime.now()
    scripts_dir  = BASE_DIR / "scripts"
    google_helper = scripts_dir / "google_helper.py"

    if HEARTBEAT_MD.exists():
        instructions = HEARTBEAT_MD.read_text().strip()
    else:
        print("No HEARTBEAT.md found.", file=sys.stderr)
        return None

    parts = [
        f"<system>You are {AGENT_NAME}, an always-on executive AI assistant.",
        f"Current date/time: {now.strftime('%A, %B %d %Y at %H:%M')}",
        f"Last heartbeat: {state.get('last_run', 'never')}",
    ]

    recent_alerts = state.get("last_alerts", [])
    if recent_alerts:
        parts.append("\nAlerts you already sent recently (DO NOT repeat these):")
        for a in recent_alerts[-5:]:
            parts.append(f"  - {a}")

    parts.append("</system>\n")
    parts.append(instructions)
    parts.append("")

    # Journal context
    new_entries = get_new_journal_since(state.get("last_run"))
    all_entries = get_journal_entries(24)
    if new_entries:
        parts.append("\n<new_activity_since_last_heartbeat>")
        for e in new_entries:
            parts.append(f"  [{e['time']}] [{e['source']}] {e['summary']}")
        parts.append("</new_activity_since_last_heartbeat>")
    if all_entries:
        parts.append("\n<last_24h_journal>")
        for e in all_entries:
            parts.append(f"  [{e['time']}] [{e['source']}] {e['summary']}")
        parts.append("</last_24h_journal>")

    # Teams messages
    teams_lines = get_new_teams_messages(state.get("last_run"))
    if teams_lines:
        parts.append("\n<new_teams_messages_since_last_heartbeat>")
        parts.append("Evaluate urgency: DMs/@mentions = HIGH, group = MED, reactions = LOW")
        for line in teams_lines:
            parts.append(f"  {line}")
        parts.append("</new_teams_messages_since_last_heartbeat>")

    # Persistent memory
    memories = get_memories()
    if memories:
        parts.append("\n<persistent_memory>")
        for m in memories:
            parts.append(f"  - {m['key']}: {m['value']}")
        parts.append("</persistent_memory>")

    # Morning briefing flag
    is_morning = 7 <= now.hour <= 9
    daily_sent_today = (state.get("last_daily") or "")[:10] == now.strftime("%Y-%m-%d")
    if is_morning and not daily_sent_today:
        parts.append("\n⏰ It's morning — send today's briefing (include a learning question at the end).")

    # Pre-meeting check
    upcoming_meetings = check_upcoming_meetings(15)  # next 15 minutes
    if upcoming_meetings:
        parts.append(f"\n⚡ PRE-MEETING ALERT: Meeting starting in ~15 minutes:")
        for meeting in upcoming_meetings:
            parts.append(f"  {meeting}")
        parts.append("Generate a brief meeting prep summary: who is attending (check memory for context), recent email threads related to this meeting, any outstanding action items. Format as a concise pre-meeting brief.")

    # Learning question state
    today_str = now.strftime("%Y-%m-%d")
    q_count = state.get("questions_asked_today", 0) if state.get("questions_date") == today_str else 0
    parts.append(f"\n<learning_state>")
    parts.append(f"  questions_asked_today: {q_count} / 3")
    parts.append(f"  last_question_time: {state.get('last_question_time', 'never')}")
    if q_count >= 3:
        parts.append("  NOTE: Daily question limit reached. Do NOT ask a learning question this cycle.")
    parts.append("</learning_state>")

    parts.append(f"""
AVAILABLE TOOLS (you have Bash access):
  📧 Email:
    python3 -W ignore {google_helper} gmail_unread [limit]
    {scripts_dir}/get_recent_mail.sh [limit]
  📅 Calendar:
    {scripts_dir}/get_calendar_events.sh [days_ahead]
    python3 -W ignore {google_helper} calendar_today [days_ahead]
  ✅ Tasks/Reminders:
    {scripts_dir}/get_reminders.sh
    {scripts_dir}/get_reminders.sh "Tasks - AG"
  💬 iMessage:
    {scripts_dir}/get_recent_imessages.sh [limit] [contact]
    {scripts_dir}/send_imessage.sh <phone> <message>
  🟣 Teams:
    {scripts_dir}/get_teams_messages.sh [limit]
    {scripts_dir}/get_teams_messages.sh 30 "<search>"

For morning briefing: check calendar, gmail_unread, reminders, teams.
During regular heartbeats: only check what's relevant — don't check everything every cycle.
Do not restart or reinstall the OpenClaw gateway service from heartbeat logic unless the user explicitly asked for that in the active conversation.
""")

    parts.append("""
IMPORTANT OUTPUT RULES:
- Only the visible message portion of your response will be pushed as a notification to the AntiGravity dashboard.
- Do NOT narrate your thinking. Do NOT describe what you're doing.
- If nothing needs attention: respond with ONLY the word: HEARTBEAT_OK
- If something needs attention: write ONLY the message the user should see — short, clear, actionable.
- After the visible message, you MAY add directive lines on separate lines:
  [PROMOTE target=<daily|longterm|relationship|use_cases|learning|status> text="..."]
  [IMPROVEMENT title="..." summary="..." priority=<high|medium|low> tags=tag1,tag2]
  [TASK title="..." summary="..." priority=<high|medium|low> tags=tag1,tag2]
  [REMEMBER key=<key> value="..."]
- You may also manage agents directly:
  [DELEGATE task=<taskId> agent=<agentId> subject="..." body="..."]
  [MESSAGE from=<agentId> to=<agentId> subject="..." body="..." tasks=TASK-1,TASK-2]
  [HIRE_AGENT name="..." lane="..." description="..." duties="duty a|duty b" provider="..." model="..." fallback="..." auth="default" reasoning="medium" subagents=true subagent_model="..." subagent_depth=1 tags="tag1|tag2"]
  [REFINE_AGENT agent=<agentId> note="..."]
  [REQUEST_REVIEW task=<taskId> reviewer=<agentId> subject="..." body="..."]
  [NEEDS_REVISION task=<taskId> owner=<agentId> reviewer=<agentId> subject="..." body="..."]
  [APPROVE task=<taskId> status=<done|review|blocked> note="..."]
  [CREATE_CRON name="..." kind=<every|cron|at> every_ms=300000 expr="0 7 * * *" tz="America/Phoenix" at="2026-03-10T15:00:00Z" session=<main|isolated> agent=<agentId> wake=<now|next-heartbeat> message="..."]
  [SPAWN_SUBAGENT agent=<agentId> task="..." model="..." thinking="..." timeout=900 cleanup=<keep|delete> sandbox=<inherit|require> session=<main>]
  [SPAWN_TEAM agents=agent1,agent2 task="..." timeout=900 cleanup=<keep|delete> sandbox=<inherit|require> session=<main>]
  [SKILL_GAP agent=<agentId> title="..." summary="..." priority=<high|medium|low> tags=tag1,tag2]
  [INSTALL_SKILL agent=<agentId> slug=<marketplace-slug> subject="..." body="..."]
- Use directives when you learn something durable, need to promote memory automatically, or detect improvement work that should become tracked follow-up.
- Example good: "📅 Reminder: Team standup in 30 minutes."
- Example bad: "Let me check the journal... I found 3 entries..."

Now evaluate your checklist and respond.""")

    return "\n".join(parts)

# ── Run Claude ────────────────────────────────────────────────────────────────

def run_claude(prompt: str):
    try:
        env = os.environ.copy()
        for key in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
            env.pop(key, None)
        result = subprocess.run(
            [CLAUDE_CLI, "-p", prompt,
             "--model", CLAUDE_MODEL,
             "--output-format", "text",
             "--no-session-persistence",
             "--tools", "Bash", "--dangerously-skip-permissions",
             "--disable-slash-commands", "--setting-sources", ""],
            capture_output=True, text=True, env=env, timeout=90)
        if result.returncode != 0:
            print(f"Claude error: {result.stderr[:200]}", file=sys.stderr)
            return None
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        print("Claude timed out", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Claude failed: {e}", file=sys.stderr)
        return None

# ── Journal helper ────────────────────────────────────────────────────────────

def log_to_journal(summary: str):
    try:
        conn = sqlite3.connect(str(JOURNAL_DB))
        conn.execute(
            "INSERT INTO activity_log (timestamp,source,session_type,summary,details,tags) "
            "VALUES (?,?,?,?,?,?)",
            (datetime.utcnow().isoformat(), "heartbeat", "heartbeat",
             summary, None, "heartbeat,proactive"))
        conn.commit()
        conn.close()
    except Exception:
        pass

# ── Main ──────────────────────────────────────────────────────────────────────

def run_heartbeat():
    now = datetime.now()

    # Respect active hours (7 AM - 11 PM)
    if now.hour < 7 or now.hour >= 23:
        print(f"[{now.isoformat()}] Outside active hours, skipping.")
        return

    state = load_state()
    prompt = build_heartbeat_prompt(state)
    if not prompt:
        return

    print(f"[{now.isoformat()}] Running heartbeat...")
    response = run_claude(prompt)

    if not response:
        print("No response from Claude.")
        state["last_run"] = now.isoformat()
        save_state(state)
        return

    outcome = process_runtime_directives(
        response,
        remember_callback=save_memory_sync,
        source="heartbeat",
    )
    visible_response = outcome.clean_text.strip() or "HEARTBEAT_OK"

    if visible_response == "HEARTBEAT_OK":
        print(f"[{now.isoformat()}] HEARTBEAT_OK — nothing to report")
        log_to_journal("Heartbeat: all clear")
        if outcome.applied:
            log_to_journal(f"Heartbeat automation applied: {', '.join(outcome.applied[:5])}")
    else:
        # Determine urgency
        urgency = "high" if any(w in visible_response.lower() for w in ["urgent", "asap", "critical", "🚨"]) else "normal"

        # Push to dashboard (broadcasts to all connected browsers)
        push_to_dashboard(visible_response, urgency=urgency)
        journal_summary = f"Proactive alert: {visible_response[:100]}"
        if outcome.applied:
            journal_summary += f" | automation={','.join(outcome.applied[:4])}"
        log_to_journal(journal_summary)

        # Track sent alerts to avoid repeats
        alerts = state.get("last_alerts", [])
        alerts.append(visible_response[:100])
        state["last_alerts"] = alerts[-10:]
        print(f"[{now.isoformat()}] Alert sent: {visible_response[:80]}")

        # Track learning questions (tagged with 🎓)
        today_str = now.strftime("%Y-%m-%d")
        if "🎓" in visible_response:
            if state.get("questions_date") != today_str:
                state["questions_asked_today"] = 0
                state["questions_date"] = today_str
            state["questions_asked_today"] = state.get("questions_asked_today", 0) + 1
            state["last_question_time"] = now.isoformat()
        elif state.get("questions_date") != today_str:
            state["questions_asked_today"] = 0
            state["questions_date"] = today_str

    # Update daily briefing flag
    if is_morning := (7 <= now.hour <= 9):
        if (state.get("last_daily") or "")[:10] != now.strftime("%Y-%m-%d"):
            state["last_daily"] = now.isoformat()

    state["last_run"] = now.isoformat()
    save_state(state)

if __name__ == "__main__":
    run_heartbeat()
