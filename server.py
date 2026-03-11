"""
AntiGravity Command Center
- Mobile-first PWA served via FastAPI + Cloudflare Tunnel
- Full Claude CLI agent with Mac tool access (Gmail, Calendar, iMessage, Teams)
- WebSocket real-time chat streaming + heartbeat push
- Action items, tools registry, notifications, persistent memory
- No Telegram dependency — native on all devices via Cloudflare
"""

import asyncio
import hashlib
import io
import json
import os
import time
import shutil
import subprocess
import logging
import re
import sys
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import aiosqlite
from dotenv import load_dotenv
from runtime_directives import process_runtime_directives

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("antigravity")

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR    = Path(__file__).resolve().parent  # /antigravity/
SCRIPTS_DIR = BASE_DIR / "scripts"
DATA_DIR    = BASE_DIR / "data"
STATIC_DIR  = BASE_DIR / "static"
DB_PATH     = DATA_DIR / "antigravity.db"   # command center DB
MEMORY_DB   = DATA_DIR / "memory.db"        # persistent memory (shared with heartbeat)
JOURNAL_DB  = DATA_DIR / "journal.db"       # activity journal
AGENT_REGISTRY_DIR = BASE_DIR / ".antigravity" / "agents"
AGENT_RUNTIME_DIR = BASE_DIR / ".antigravity" / "runtime"
AGENT_ROSTER_PATH = AGENT_RUNTIME_DIR / "roster.json"
AGENT_RUNTIME_SESSIONS_PATH = AGENT_RUNTIME_DIR / "sessions.json"

CLAUDE_CLI   = os.getenv("CLAUDE_CLI_PATH") or shutil.which("claude") or "/Users/cderamos/.local/bin/claude"
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "sonnet")
AGENT_NAME   = os.getenv("AGENT_NAME", "AntiGravity")
AGENT_PERSONA = os.getenv("AGENT_PERSONA",
    "You are AntiGravity, an executive AI assistant with genius-level knowledge running on "
    "Christian Ramos's Mac. You help manage his business, projects, communications, and life.\n\n"
    "ABOUT CHRISTIAN:\n"
    "- Partner & Director of Technology at VisualGraphx (visual communications company)\n"
    "- Email: christian@visualgraphx.com\n"
    "- Expanding role to oversee strategic technology initiatives across the PrintDeed group\n"
    "- Working style: direct, crass, efficient — he values bluntness and hates fluff\n\n"
    "ACTIVE PROJECTS (Feb 2026):\n"
    "- Clarity Platform: AI document processing platform, 90% complete, beta Feb 28, go-live Mar 7-10. "
    "Built on Claude API. Primary alternative to Klippa (which has 60% OCR accuracy vs Claude's 95%).\n"
    "- Hatco Integration: hardware client, active development\n"
    "- G&C Project: active development\n"
    "- POP System: active\n"
    "- Litify: legal platform integration\n"
    "- ServFlo: Kyle Lasseter's initiative\n\n"
    "KEY PEOPLE:\n"
    "- Todd Delano: Principal Partner (hardest in the room, holds accountability)\n"
    "- Craig Brown: Operational Partner (concerned about de-prioritization)\n"
    "- Kyle Lasseter: Partner, ServFlo (initiated projects without clear commitment)\n"
    "- Eric Rosenfeld: CIO (focused on technical delivery dates)\n"
    "- Mark Smith: CFO (focused on ROI, cost justification)\n"
    "- John Flynn: Legal\n"
    "- Sandy: key internal contact\n\n"
    "CURRENT PRIORITIES:\n"
    "- Clarity go-live March 7-10 (non-negotiable)\n"
    "- Closing out Klippa decision (replace with Claude-based Clarity pipeline)\n"
    "- Tying up VG loose ends, establishing governance structure\n"
    "- Resource picture: 9.3 FTE at $11,200/month via PrintDeed\n\n"
    "CHIEF OF STAFF RULES:\n"
    "- You are not a solo worker when specialist agents exist.\n"
    "- If a request clearly belongs to a coworker lane, delegate first instead of personally doing the whole workflow end-to-end.\n"
    "- Use comms for email, inbox triage, attachment handling, replies, spam, unsubscribe, and message workflows.\n"
    "- Use calendar for meetings, reminders, prep, scheduling, and time conflict work.\n"
    "- Use notes for document digestion, meeting notes, summaries, extraction, and durable writeups.\n"
    "- Use ops for runtime, services, tunnels, logs, auth path, and system health issues.\n"
    "- Use research for learning, source gathering, synthesis, and exploratory research.\n"
    "- Use build for coding, UI, tooling, automation, and implementation changes.\n"
    "- Use verifier for review, approval, regression checks, and final quality gates.\n"
    "- When a task spans multiple lanes, orchestrate the handoff chain instead of collapsing everything into one answer.\n"
    "- For repetitive ongoing work, prefer delegation, cron creation, and heartbeat policies over manual repetition.\n"
    "- Do not narrate lane-owned work as repeated solo 'Let me...' steps when a coworker agent should own that work.\n"
    "- When specialist agents are used, make that visible in the user-facing answer with a short staffing summary.\n"
    "- If no delegation was used on lane-owned work, justify that choice in one sentence.\n"
    "- Do not restart the gateway casually. Restart is a last resort only after local health checks fail and simpler causes (registry mismatch, stale UI state, missing agent scaffolds, dynamic config reload) are ruled out.\n"
    "- If a gateway restart is truly required, say so explicitly and warn that it will briefly disconnect active chat.\n\n"
    "You are proactive, thorough, and always looking for ways to save Christian time. "
    "Be direct and efficient. Use markdown in your responses for clarity (headers, bullets, bold). "
    "Never hedge unnecessarily — give actionable answers.")

START_TIME = time.time()
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Active Claude subprocess (for cancel support)
_active_proc: dict = {"proc": None, "ws": None}

# Pre-meeting briefing tracker (avoid duplicate briefs)
_briefed_events: set = set()

# End-of-day summary tracker
_eod_date: str = ""

app = FastAPI(title="AntiGravity Command Center")

# ── Tool Prompt — gives Claude full Mac access ────────────────────────────────

TOOL_PROMPT = f"""
TOOL USE RULES:
- You have FULL Bash access on the user's Mac. USE IT. Never say you can't do something — try it.
- ALWAYS use tools first before asking the user for info you could look up yourself.
- NEVER restart, stop, install, or uninstall the OpenClaw gateway service unless the user explicitly asked for that exact service mutation in the current conversation.
- If the gateway appears unhealthy, diagnose first. Prefer health checks, logs, config inspection, and non-disruptive fixes before any restart.
- Suppress Python warnings with: python3 -W ignore {SCRIPTS_DIR}/google_helper.py <command>

📧 EMAIL — Apple Mail + Gmail API (all accounts synced):
  Apple Mail (read across all accounts):
    {SCRIPTS_DIR}/get_recent_mail.sh [limit]
    {SCRIPTS_DIR}/search_mail.sh "<query>"
    {SCRIPTS_DIR}/read_mail.sh "<subject>"
  Gmail API (work: christian@visualgraphx.com):
    python3 -W ignore {SCRIPTS_DIR}/google_helper.py gmail_unread [limit]
    python3 -W ignore {SCRIPTS_DIR}/google_helper.py gmail_search "<query>" [limit]
    python3 -W ignore {SCRIPTS_DIR}/google_helper.py gmail_read <message_id>
    {SCRIPTS_DIR}/list_mail_attachments.sh <message_id>
    {SCRIPTS_DIR}/download_mail_attachment.sh <message_id> <attachment_id> [filename] [output_dir]
    python3 -W ignore {SCRIPTS_DIR}/google_helper.py gmail_send "<to>" "<subject>" "<body>"

📅 CALENDAR — Apple Calendar (all accounts merged):
  {SCRIPTS_DIR}/get_calendar_events.sh [days_ahead]
  {SCRIPTS_DIR}/create_calendar_event.sh "<title>" "<start>" "<end>" [calendar] [notes]
  Google Calendar API:
    python3 -W ignore {SCRIPTS_DIR}/google_helper.py calendar_today [days_ahead]
    python3 -W ignore {SCRIPTS_DIR}/google_helper.py calendar_create "<title>" "<start_iso>" "<end_iso>"

✅ TASKS & REMINDERS — Apple Reminders (syncs iCloud to iPhone/iPad):
  Lists: "Tasks - AG" (main tasks), "Reminders", "Family Groceries"
  {SCRIPTS_DIR}/get_reminders.sh — all pending reminders
  {SCRIPTS_DIR}/get_reminders.sh "Tasks - AG" — tasks only
  {SCRIPTS_DIR}/create_reminder.sh "<title>" "Tasks - AG" "[due_date]" "[notes]"

📇 CONTACTS — Apple Contacts:
  {SCRIPTS_DIR}/search_contacts.sh <name>
  python3 -W ignore {SCRIPTS_DIR}/google_helper.py contacts_search "<name>"

📝 NOTES — Apple Notes (syncs to iPhone/iPad):
  osascript -e 'tell app "Notes" to get name of every note'
  osascript -e 'tell app "Notes" to make new note at folder "Notes" with properties {{name:"<title>", body:"<content>"}}'

💬 iMESSAGE:
  {SCRIPTS_DIR}/send_imessage.sh <phone> <message>
  {SCRIPTS_DIR}/get_recent_imessages.sh [limit] [contact]

🟣 MICROSOFT TEAMS — via macOS Notification Center (read-only):
  {SCRIPTS_DIR}/get_teams_messages.sh [limit]
  {SCRIPTS_DIR}/get_teams_messages.sh 30 "<search>"
  Known channels: Sandy, Designer KD-PD, OPS Dev Team, PrintDeed Dev Chat

💻 SYSTEM: Any bash command. osascript for any Mac app.

OUTPUT: Respond concisely. If user says to remember something: [REMEMBER key=<key> value=<value>]
You may also emit directive lines on their own lines:
  [PROMOTE target=<daily|longterm|relationship|use_cases|learning|status> text="..."]
  [IMPROVEMENT title="..." summary="..." priority=<high|medium|low> tags=tag1,tag2]
  [TASK title="..." summary="..." priority=<high|medium|low> tags=tag1,tag2]
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
Directives are applied automatically and are not shown to the user."""

# ── Memory helpers ────────────────────────────────────────────────────────────

async def get_memories(user_id: int = 0):
    try:
        async with aiosqlite.connect(str(MEMORY_DB)) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT key, value FROM memory WHERE user_id=? ORDER BY updated_at DESC LIMIT 30",
                (user_id,))
            rows = await cur.fetchall()
        return [{"key": r["key"], "value": r["value"]} for r in rows]
    except Exception:
        return []

async def save_memory(key: str, value: str, user_id: int = 0):
    now = datetime.utcnow().isoformat()
    try:
        async with aiosqlite.connect(str(MEMORY_DB)) as db:
            row = await (await db.execute(
                "SELECT id FROM memory WHERE user_id=? AND key=?", (user_id, key))).fetchone()
            if row:
                await db.execute(
                    "UPDATE memory SET value=?, updated_at=? WHERE id=?", (value, now, row[0]))
            else:
                await db.execute(
                    "INSERT INTO memory (user_id,key,value,created_at,updated_at) VALUES (?,?,?,?,?)",
                    (user_id, key, value, now, now))
            await db.commit()
    except Exception as e:
        logger.warning(f"save_memory error: {e}")

async def process_remember(response: str, user_id: int = 0):
    for line in response.split("\n"):
        line = line.strip()
        if line.startswith("[REMEMBER ") and line.endswith("]"):
            try:
                inner = line[10:-1]
                key_part, _, value_part = inner.partition(" value=")
                key = key_part.replace("key=", "").strip()
                value = value_part.strip()
                if key and value:
                    await save_memory(key, value, user_id)
                    logger.info(f"Stored memory: {key} = {value[:50]}")
            except Exception:
                pass


def save_memory_sync(key: str, value: str, user_id: int = 0):
    now = datetime.utcnow().isoformat()
    conn = sqlite3.connect(str(MEMORY_DB))
    try:
        row = conn.execute(
            "SELECT id FROM memory WHERE user_id=? AND key=?", (user_id, key)
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE memory SET value=?, updated_at=? WHERE id=?",
                (value, now, row[0]),
            )
        else:
            conn.execute(
                "INSERT INTO memory (user_id,key,value,created_at,updated_at) VALUES (?,?,?,?,?)",
                (user_id, key, value, now, now),
            )
        conn.commit()
    finally:
        conn.close()

async def retrieve_relevant_chunks(query: str, limit: int = 5) -> list[dict]:
    """FTS5 search over document chunks for RAG context injection."""
    if not query or len(query.strip()) < 3:
        return []
    try:
        # Strip FTS5 special chars; wrap in double-quotes for phrase matching
        clean = re.sub(r'["\*\(\)\[\]\{\}:^~\-]', ' ', query).strip()
        clean = re.sub(r'\s+', ' ', clean)
        if not clean:
            return []
        # Double-quoting the phrase avoids FTS5 operator syntax errors
        fts_query = f'"{clean}"'
        db = await get_db()
        rows = await fetchall(db,
            """SELECT dc.content, d.filename, dc.chunk_index
               FROM chunks_fts cf
               JOIN document_chunks dc ON dc.id = cf.rowid
               JOIN documents d ON d.id = dc.document_id
               WHERE chunks_fts MATCH ?
               ORDER BY rank LIMIT ?""",
            (fts_query, limit))
        await db.close()
        return [{"content": r["content"], "filename": r["filename"], "chunk_index": r["chunk_index"]} for r in rows]
    except Exception as e:
        logger.warning(f"retrieve_relevant_chunks error: {e}")
        return []

async def log_activity(source: str, session_type: str, summary: str, details: str = None):
    try:
        async with aiosqlite.connect(str(JOURNAL_DB)) as db:
            await db.execute(
                "INSERT INTO activity_log (timestamp,source,session_type,summary,details) VALUES (?,?,?,?,?)",
                (datetime.utcnow().isoformat(), source, session_type, summary, details))
            await db.commit()
    except Exception as e:
        logger.warning(f"log_activity error: {e}")


def load_agent_roster_payload():
    try:
        if AGENT_ROSTER_PATH.exists():
            return json.loads(AGENT_ROSTER_PATH.read_text())
    except Exception as e:
        logger.warning(f"load_agent_roster_payload error: {e}")
    return None


def load_agent_registry_summary():
    try:
        roster = load_agent_roster_payload()
        if roster and isinstance(roster.get("agents"), list):
            summaries = []
            for data in roster.get("agents", []):
                runtime = data.get("runtime") or {}
                summaries.append({
                    "id": data.get("id"),
                    "name": data.get("name"),
                    "lane": data.get("lane"),
                    "description": data.get("description"),
                    "responsibilities": data.get("responsibilities", [])[:4],
                    "modelProvider": data.get("modelProvider") or runtime.get("modelProvider"),
                    "defaultModel": data.get("defaultModel") or runtime.get("model"),
                    "canSpawnSubagents": data.get("canSpawnSubagents", False),
                    "escalatesTo": data.get("escalatesTo"),
                    "sessionLabel": data.get("sessionLabel") or runtime.get("sessionLabel"),
                    "desiredStatus": data.get("desiredStatus"),
                    "observedState": runtime.get("observedState"),
                    "currentTaskId": runtime.get("currentTaskId"),
                })
            return summaries
        if not AGENT_REGISTRY_DIR.exists():
            return []
        summaries = []
        for file_path in sorted(AGENT_REGISTRY_DIR.glob("*.json")):
            data = json.loads(file_path.read_text())
            summaries.append({
                "id": data.get("id"),
                "name": data.get("name"),
                "lane": data.get("lane"),
                "description": data.get("description"),
                "responsibilities": data.get("responsibilities", [])[:4],
                "modelProvider": data.get("modelProvider"),
                "defaultModel": data.get("defaultModel"),
                "canSpawnSubagents": data.get("canSpawnSubagents", False),
                "escalatesTo": data.get("escalatesTo"),
                "sessionLabel": data.get("sessionLabel"),
                "desiredStatus": data.get("desiredStatus"),
                "observedState": (data.get("runtime") or {}).get("observedState"),
                "currentTaskId": (data.get("runtime") or {}).get("currentTaskId"),
            })
        return summaries
    except Exception as e:
        logger.warning(f"load_agent_registry_summary error: {e}")
        return []

# ── Database ──────────────────────────────────────────────────────────────────

async def get_db():
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    return db

async def fetchone(db, query, params=()):
    cur = await db.execute(query, params)
    return await cur.fetchone()

async def fetchall(db, query, params=()):
    cur = await db.execute(query, params)
    return await cur.fetchall()

async def init_db():
    db = await get_db()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL, sender TEXT, subject TEXT, content TEXT,
            priority TEXT DEFAULT 'MED', timestamp TEXT DEFAULT (datetime('now')),
            read INTEGER DEFAULT 0, metadata TEXT
        );
        CREATE TABLE IF NOT EXISTS action_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
            source_msg_id INTEGER, suggested_action TEXT, suggested_content TEXT,
            status TEXT DEFAULT 'pending', priority TEXT DEFAULT 'MED',
            created_at TEXT DEFAULT (datetime('now')), resolved_at TEXT,
            resolved_by TEXT, metadata TEXT
        );
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL, content TEXT NOT NULL,
            timestamp TEXT DEFAULT (datetime('now')),
            action_item_id INTEGER, metadata TEXT
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL, body TEXT, type TEXT DEFAULT 'info',
            action_item_id INTEGER, read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS tools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL, type TEXT NOT NULL DEFAULT 'tool',
            description TEXT, icon TEXT DEFAULT '🔧', enabled INTEGER DEFAULT 1,
            config TEXT DEFAULT '{}', version TEXT DEFAULT '1.0.0',
            author TEXT DEFAULT 'system', capabilities TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
            last_used TEXT, usage_count INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS tool_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_id INTEGER NOT NULL, action TEXT, input TEXT, output TEXT,
            success INTEGER DEFAULT 1, duration_ms INTEGER,
            timestamp TEXT DEFAULT (datetime('now'))
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            sender, subject, content, content=messages, content_rowid=id
        );
        CREATE TABLE IF NOT EXISTS standing_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_text TEXT NOT NULL,
            trigger_type TEXT DEFAULT 'message',
            auto_execute INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'MED',
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            last_triggered TEXT,
            trigger_count INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            tags TEXT DEFAULT '',
            pinned INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS delegations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person TEXT NOT NULL,
            task TEXT NOT NULL,
            assigned_date TEXT DEFAULT (datetime('now')),
            due_date TEXT,
            status TEXT DEFAULT 'pending',
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    await db.commit()

    # Spam column migration (safe — IF NOT EXISTS equivalent via try/except)
    try:
        await db.execute("ALTER TABLE messages ADD COLUMN spam INTEGER DEFAULT 0")
        await db.commit()
    except Exception:
        pass  # column already exists

    # Spam rules table
    await db.execute("""
        CREATE TABLE IF NOT EXISTS spam_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern TEXT NOT NULL,
            pattern_type TEXT DEFAULT 'sender',
            created_at TEXT DEFAULT (datetime('now')),
            match_count INTEGER DEFAULT 0,
            UNIQUE(pattern, pattern_type)
        )
    """)
    await db.commit()

    # RAG: Documents + chunks
    await db.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_hash TEXT UNIQUE,
            file_size INTEGER,
            mime_type TEXT,
            chunk_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            metadata TEXT DEFAULT '{}'
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS document_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            UNIQUE(document_id, chunk_index)
        )
    """)
    await db.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
            content,
            content=document_chunks,
            content_rowid=id
        )
    """)
    await db.commit()

    # Seed default standing order if table is empty
    so_count = await fetchone(db, "SELECT COUNT(*) as c FROM standing_orders")
    if so_count["c"] == 0:
        await db.execute(
            "INSERT INTO standing_orders (rule_text, trigger_type, auto_execute, priority) VALUES (?,?,?,?)",
            ("When I receive a message from Ashley, notify me immediately", "message", 0, "HIGH"))
        await db.commit()

    count = await fetchone(db, "SELECT COUNT(*) as c FROM tools")
    if count["c"] == 0:
        defaults = [
            ("Gmail Scanner",    "agent", "Scans Gmail for important messages",          "📧", '["gmail","email"]'),
            ("Teams Monitor",    "agent", "Monitors Microsoft Teams messages",            "💬", '["teams","chat"]'),
            ("Calendar Sync",    "agent", "Syncs calendar events and reminders",          "📅", '["calendar","events"]'),
            ("iMessage Bridge",  "agent", "Reads and sends iMessages",                   "💬", '["imessage","sms"]'),
            ("Smart Prioritizer","skill", "AI-powered message priority classification",   "🧠", '["priority","ai"]'),
            ("Auto Drafter",     "skill", "AI-powered reply and document drafting",       "✍️",  '["drafting","ai"]'),
            ("Meeting Scheduler","tool",  "Finds optimal meeting times across calendars", "🗓️",  '["scheduling","calendar"]'),
        ]
        for name, type_, desc, icon, caps in defaults:
            await db.execute(
                "INSERT INTO tools (name, type, description, icon, capabilities) VALUES (?,?,?,?,?)",
                (name, type_, desc, icon, caps))
        await db.commit()
    await db.close()

# ── Standing Orders Evaluation ────────────────────────────────────────────────

async def evaluate_standing_orders(message_content: str, sender: str, subject: str):
    """Check all active standing orders against an incoming message."""
    try:
        db = await get_db()
        orders = await fetchall(db, "SELECT * FROM standing_orders WHERE active=1")
        combined = f"{sender} {subject} {message_content}".lower()
        for order in orders:
            rule = order["rule_text"]
            # Extract significant words (4+ chars) from rule_text for keyword matching
            words = [w.lower() for w in re.findall(r'\b[a-zA-Z]{4,}\b', rule)]
            triggered = any(w in combined for w in words)
            if triggered:
                await db.execute(
                    "UPDATE standing_orders SET last_triggered=datetime('now'), trigger_count=trigger_count+1 WHERE id=?",
                    (order["id"],))
                await db.commit()
                await manager.broadcast({
                    "type": "standing_order_triggered",
                    "rule": rule,
                    "message": f"\U0001f4cc Standing Order: {rule}"
                })
                logger.info(f"Standing order triggered: {rule}")
        await db.close()
    except Exception as e:
        logger.warning(f"evaluate_standing_orders error: {e}")

# ── WebSocket Hub ─────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, data: dict):
        for ws in self.connections[:]:
            try:
                await ws.send_json(data)
            except Exception:
                if ws in self.connections:
                    self.connections.remove(ws)

manager = ConnectionManager()

# ── Heartbeat Monitor ─────────────────────────────────────────────────────────

HEARTBEAT_DATA = {
    "status": "healthy", "uptime": 0, "cpu_percent": 0,
    "memory_percent": 0, "disk_percent": 0, "last_check": None,
    "bot_responsive": True, "db_size_mb": 0, "active_connections": 0,
}

async def heartbeat_monitor():
    await asyncio.sleep(5)
    while True:
        try:
            HEARTBEAT_DATA["uptime"] = int(time.time() - START_TIME)
            HEARTBEAT_DATA["active_connections"] = len(manager.connections)
            HEARTBEAT_DATA["last_check"] = datetime.now().isoformat()

            try:
                load = os.getloadavg()
                HEARTBEAT_DATA["cpu_percent"] = round((load[0] / (os.cpu_count() or 1)) * 100, 1)
            except Exception:
                pass

            try:
                import psutil
                HEARTBEAT_DATA["memory_percent"] = round(psutil.virtual_memory().percent, 1)
            except ImportError:
                try:
                    r = subprocess.run(["vm_stat"], capture_output=True, text=True, timeout=5)
                    free = active = 0
                    for line in r.stdout.split("\n"):
                        if "Pages free" in line:
                            free = int(line.split(":")[1].strip().rstrip("."))
                        if "Pages active" in line:
                            active = int(line.split(":")[1].strip().rstrip("."))
                    if active + free > 0:
                        HEARTBEAT_DATA["memory_percent"] = round(
                            (active / (active + free)) * 100, 1)
                except Exception:
                    pass

            try:
                # Measure the volume where server data actually lives, not just root
                data_path = str(Path(__file__).parent)
                usage = shutil.disk_usage(data_path)
                HEARTBEAT_DATA["disk_percent"] = round((usage.used / usage.total) * 100, 1)
            except Exception:
                pass

            try:
                HEARTBEAT_DATA["db_size_mb"] = round(
                    DB_PATH.stat().st_size / (1024 * 1024), 2)
            except Exception:
                pass

            # Bot responsive check — just verify the binary exists and runs
            try:
                proc = await asyncio.create_subprocess_exec(
                    CLAUDE_CLI, "--version",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
                HEARTBEAT_DATA["bot_responsive"] = proc.returncode == 0
                if not HEARTBEAT_DATA["bot_responsive"]:
                    logger.warning(f"Claude CLI version check failed (exit {proc.returncode})")
            except Exception as e:
                logger.warning(f"Claude CLI ping error: {type(e).__name__}: {e!r}")
                HEARTBEAT_DATA["bot_responsive"] = False

            HEARTBEAT_DATA["status"] = "healthy" if HEARTBEAT_DATA["bot_responsive"] else "degraded"
            await manager.broadcast({"type": "heartbeat", "data": HEARTBEAT_DATA})

        except Exception as e:
            logger.error(f"Heartbeat monitor error: {e}")

        await asyncio.sleep(30)

# ── Claude Agent (full Mac tool access) ──────────────────────────────────────

def build_prompt(memories: list, history: list, message: str) -> str:
    parts = [f"<system>\n{AGENT_PERSONA}"]
    parts.append(f"Current date/time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    agent_registry = load_agent_registry_summary()
    if memories:
        parts.append("\n<persistent_memory>")
        # Separate summaries from regular facts
        summaries = [m for m in memories if m['key'].startswith('conversation_summary_')]
        facts = [m for m in memories if not m['key'].startswith('conversation_summary_')]
        if facts:
            for m in facts:
                parts.append(f"- {m['key']}: {m['value']}")
        if summaries:
            parts.append("\n<recent_conversation_summaries>")
            for m in sorted(summaries, key=lambda x: x['key'], reverse=True)[:3]:
                parts.append(f"[{m['key']}]: {m['value']}")
            parts.append("</recent_conversation_summaries>")
        parts.append("</persistent_memory>")
    if agent_registry:
        parts.append("\n<coworker_agents>")
        parts.append("You have a coworker agent registry. Do not claim you have no coworkers if this list is present.")
        parts.append("Use manager directives to delegate, hire, review, create cron, and spawn subagents/teams when appropriate.")
        parts.append("Default staffing behavior:")
        parts.append("- Email, attachments, drafting, unsubscribe, spam, inbox management -> delegate to comms first.")
        parts.append("- Meeting prep, scheduling, reminders, calendar conflicts -> delegate to calendar first.")
        parts.append("- Notes, docs, attachment interpretation, meeting summaries, action extraction -> delegate to notes first.")
        parts.append("- Runtime/system/dashboard/gateway/tunnel issues -> delegate to ops first.")
        parts.append("- Research/learning/source curation -> delegate to research first.")
        parts.append("- Code/UI/tooling/automation implementation -> delegate to build first.")
        parts.append("- Validation, review, regression checks, approval -> request verifier review.")
        parts.append("If you keep the task yourself despite a clear lane owner, explain why in one sentence and only do that when delegation would be slower, riskier, or unnecessary.")
        parts.append("When delegation occurs, include a short 'Staffing' section in the user-facing answer listing which agent handled which part.")
        parts.append("For email operations, the default chain is: comms handles inbox + attachments, notes summarizes documents when needed, calendar handles schedule fallout, and CD provides the final executive read.")
        for agent in agent_registry:
            parts.append(
                f"- {agent['id']} ({agent['name']}) lane={agent.get('lane') or 'unknown'} "
                f"provider={agent.get('modelProvider') or 'unset'} "
                f"model={agent.get('defaultModel') or 'unset'} "
                f"subagents={'yes' if agent.get('canSpawnSubagents') else 'no'} "
                f"escalatesTo={agent.get('escalatesTo') or 'none'}"
            )
            if agent.get("description"):
                parts.append(f"  description: {agent['description']}")
            if agent.get("responsibilities"):
                parts.append(f"  duties: {'; '.join(agent['responsibilities'])}")
        parts.append("</coworker_agents>")
    parts.append(TOOL_PROMPT)
    parts.append("</system>\n")
    if history:
        parts.append("<conversation_history>")
        for t in history:
            label = "User" if t["role"] == "user" else AGENT_NAME
            parts.append(f"{label}: {t['content']}")
        parts.append("</conversation_history>\n")
    parts.append(f"User: {message}")
    return "\n".join(parts)

async def bot_respond(message: str, ws: WebSocket = None) -> str:
    """Full Claude agent with Mac tool access. Streams progress to WebSocket."""
    memories = await get_memories()

    # Load recent conversation history
    history = []
    try:
        db = await get_db()
        rows = await fetchall(db,
            "SELECT role, content FROM conversations ORDER BY id DESC LIMIT 10")
        await db.close()
        history = [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
    except Exception:
        pass

    full_prompt = build_prompt(memories, history, message)

    # RAG: inject relevant document chunks if available
    doc_chunks = await retrieve_relevant_chunks(message, limit=5)
    if doc_chunks:
        rag_section = "\n\n<relevant_documents>\n"
        for chunk in doc_chunks:
            rag_section += f"[{chunk['filename']}]\n{chunk['content']}\n\n"
        rag_section += "</relevant_documents>"
        full_prompt = full_prompt + rag_section

    env = os.environ.copy()
    # Strip only the nested-session guard flags — keep CLAUDE_CODE_OAUTH_TOKEN for auth
    for key in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
        env.pop(key, None)

    try:
        proc = await asyncio.create_subprocess_exec(
            CLAUDE_CLI, "-p", full_prompt,
            "--model", CLAUDE_MODEL,
            "--output-format", "stream-json", "--verbose",
            "--no-session-persistence",
            "--tools", "Bash", "--dangerously-skip-permissions",
            "--disable-slash-commands",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        _active_proc["proc"] = proc
        _active_proc["ws"]   = ws

        final_text = []
        tool_uses_seen = set()

        async def read_stream():
            while True:
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=120)
                except asyncio.TimeoutError:
                    break
                if not line:
                    break
                line = line.decode().strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                etype   = event.get("type", "")
                subtype = event.get("subtype", "")

                # Stream tool-use status updates to the browser
                if etype == "assistant" and subtype == "tool_use" and ws:
                    tool_input = event.get("input", {})
                    cmd = tool_input.get("command", "")[:80] if isinstance(tool_input, dict) else ""
                    tool_key = cmd[:40]
                    if tool_key not in tool_uses_seen:
                        tool_uses_seen.add(tool_key)
                        cl = cmd.lower()
                        if "gmail" in cl:
                            status = "📧 Checking Gmail..."
                        elif "calendar" in cl:
                            status = "📅 Checking calendar..."
                        elif "reminder" in cl or "get_reminders" in cl:
                            status = "✅ Checking reminders..."
                        elif "get_recent_imessage" in cl or "chat.db" in cl:
                            status = "💬 Reading messages..."
                        elif "send_imessage" in cl:
                            status = "💬 Sending message..."
                        elif "contact" in cl or "addressbook" in cl:
                            status = "🔍 Looking up contacts..."
                        elif "teams" in cl:
                            status = "🟣 Checking Teams..."
                        elif cmd:
                            status = "⚙️ Working..."
                        else:
                            status = None
                        if status:
                            try:
                                await ws.send_json({"type": "chat_status", "message": status})
                            except Exception:
                                pass

                if etype == "assistant" and subtype == "text":
                    delta = event.get("text", "")
                    final_text.append(delta)
                    if ws and delta:
                        try:
                            await ws.send_json({"type": "chat_stream", "delta": delta})
                        except Exception:
                            pass

                if etype == "result":
                    result_text = event.get("result", "")
                    if result_text and not final_text:
                        final_text.append(result_text)

        await read_stream()
        await proc.wait()

        response = "".join(final_text).strip()
        if not response:
            return "I couldn't generate a response. Please try again."

        await process_remember(response)
        outcome = await asyncio.to_thread(
            process_runtime_directives,
            response,
            source="chat",
        )
        clean = outcome.clean_text
        if outcome.applied:
            await log_activity("chat", "runtime_directives", ", ".join(outcome.applied))
        return clean or response

    except asyncio.CancelledError:
        return None  # cancelled — caller handles notification
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        return "Request timed out. Try a simpler question."
    except FileNotFoundError:
        return f"Claude CLI not found at '{CLAUDE_CLI}'. Make sure it's installed."
    except Exception as e:
        logger.exception("bot_respond error")
        return f"Error: {e}"
    finally:
        _active_proc["proc"] = None
        _active_proc["ws"]   = None

# ── Priority + Action helpers ─────────────────────────────────────────────────

HIGH_SENDERS  = {
    "sandy", "rahul", "carlos", "ceo", "cto",
    "ashley", "ashley de ramos",  # wife
    "bella", "dash", "christopher",  # kids
    "visual graphx", "visualgraphx",
    "hatco", "processmatter", "printdeed", "klippa",  # known clients
}
HIGH_KEYWORDS = {"urgent", "asap", "critical", "deadline", "emergency", "blocker",
                 "due today", "overdue", "past due", "action required", "response needed"}

async def is_spam_sender(sender: str = "", subject: str = "") -> bool:
    """Return True if sender/subject matches a known spam rule."""
    try:
        db = await get_db()
        rules = await fetchall(db, "SELECT pattern, pattern_type FROM spam_rules")
        await db.close()
        sender_lower  = (sender  or "").lower()
        subject_lower = (subject or "").lower()
        for r in rules:
            pat = (r["pattern"] or "").lower()
            if not pat:
                continue
            if r["pattern_type"] == "sender"  and pat in sender_lower:  return True
            if r["pattern_type"] == "domain"  and pat in sender_lower:  return True
            if r["pattern_type"] == "subject" and pat in subject_lower: return True
        return False
    except Exception:
        return False

def classify_priority(sender: str = "", content: str = "", subject: str = "") -> str:
    text = f"{sender} {content} {subject}".lower()
    if any(k in text for k in HIGH_KEYWORDS) or any(s in sender.lower() for s in HIGH_SENDERS):
        return "HIGH"
    if any(w in text for w in ["meeting", "review", "update", "fyi", "reminder"]):
        return "MED"
    return "LOW"

def score_message(msg: dict) -> float:
    """Score a message 0-100 for how much it needs the executive's attention today."""
    score = 0.0
    sender = (msg.get("sender") or "").lower()
    content = (msg.get("content") or "").lower()
    subject = (msg.get("subject") or "").lower()
    source = (msg.get("source") or "").lower()
    text = f"{sender} {content} {subject}"

    # Priority base score
    priority = msg.get("priority", "LOW")
    if priority == "HIGH": score += 40
    elif priority == "MED": score += 20

    # Source weights
    if source == "imessage": score += 25  # personal = high priority
    if source == "gmail": score += 15
    if source == "calendar": score += 10

    # Known important senders
    if any(s in sender for s in HIGH_SENDERS): score += 30

    # Urgency keywords
    if any(k in text for k in HIGH_KEYWORDS): score += 25

    # Time sensitivity — calendar events today get boosted
    if source == "calendar":
        ts = msg.get("timestamp") or ""
        try:
            msg_date = datetime.fromisoformat(ts.replace("Z","")).date()
            if msg_date == datetime.now().date(): score += 20
        except Exception:
            pass

    # Recency — newer messages score higher
    try:
        ts = msg.get("timestamp") or ""
        msg_time = datetime.fromisoformat(ts.replace("Z","").replace(" ","T"))
        hours_old = (datetime.now() - msg_time).total_seconds() / 3600
        if hours_old < 2: score += 20
        elif hours_old < 8: score += 10
        elif hours_old < 24: score += 5
    except Exception:
        pass

    return min(score, 100.0)

ACTION_TYPES = {
    "reply":     "Draft Reply",
    "schedule":  "Schedule Meeting",
    "follow_up": "Follow Up",
    "review":    "Review & Acknowledge",
    "delegate":  "Delegate Task",
    "archive":   "Archive / Dismiss",
}

def suggest_action_type(msg: dict) -> str:
    content = f"{msg.get('subject','')}{msg.get('content','')}".lower()
    if msg.get("source") == "calendar":
        return "schedule"
    if any(w in content for w in ["reply", "respond", "answer", "get back"]):
        return "reply"
    if any(w in content for w in ["meeting", "schedule", "calendar", "invite"]):
        return "schedule"
    if any(w in content for w in ["review", "approve", "sign off", "look at"]):
        return "review"
    if any(w in content for w in ["follow up", "check in", "ping", "reminder"]):
        return "follow_up"
    return "reply" if msg.get("priority") == "HIGH" else "review"

async def run_script(cmd: list, timeout: int = 15) -> str:
    """Run a script subprocess and return stdout as string."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return (stdout or b"").decode("utf-8", errors="replace").strip()
    except asyncio.TimeoutError:
        return "Error: script timed out"
    except Exception as e:
        return f"Error: {e}"

# ── Background Scanner ────────────────────────────────────────────────────────

async def background_scanner():
    await asyncio.sleep(15)
    while True:
        try:
            db = await get_db()
            rows = await fetchall(db, """
                SELECT m.* FROM messages m
                LEFT JOIN action_items a ON a.source_msg_id = m.id
                WHERE a.id IS NULL AND m.priority IN ('HIGH','MED')
                AND m.timestamp > datetime('now', '-24 hours')
                ORDER BY m.timestamp DESC LIMIT 10
            """)
            for row in rows:
                msg = dict(row)
                action_type = suggest_action_type(msg)
                cursor = await db.execute("""
                    INSERT INTO action_items
                        (type, title, description, source_msg_id, suggested_action, priority)
                    VALUES (?,?,?,?,?,?)
                """, (
                    action_type,
                    f"{ACTION_TYPES.get(action_type,'Action')}: "
                    f"{msg.get('subject') or msg.get('sender','Unknown')}",
                    (msg.get("content", ""))[:200],
                    msg["id"],
                    action_type,
                    msg.get("priority", "MED"),
                ))
                action_id = cursor.lastrowid
                await db.execute("""
                    INSERT INTO notifications (title, body, type, action_item_id)
                    VALUES (?,?,?,?)
                """, (
                    f"New: {ACTION_TYPES.get(action_type,'Action')}",
                    f"From {msg.get('sender','Unknown')}: "
                    f"{(msg.get('subject') or msg.get('content',''))[:80]}",
                    "action" if msg.get("priority") == "HIGH" else "info",
                    action_id,
                ))
            await db.commit()
            if rows:
                await manager.broadcast({"type": "new_actions", "count": len(rows)})
            await db.close()
        except Exception as e:
            logger.error(f"Background scanner error: {e}")
        await asyncio.sleep(60)

# ── Memory + Journal DB init ──────────────────────────────────────────────────

async def init_memory_db():
    async with aiosqlite.connect(str(MEMORY_DB)) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 0,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, key)
            );
        """)
        await db.commit()

async def init_journal_db():
    async with aiosqlite.connect(str(JOURNAL_DB)) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                source TEXT,
                session_type TEXT,
                summary TEXT,
                details TEXT,
                tags TEXT
            );
        """)
        await db.commit()

# ── Conversation Summarization ────────────────────────────────────────────────

async def summarize_conversations_to_memory():
    """Daily: summarize yesterday's conversations and write to memory.db for cross-session context."""
    while True:
        await asyncio.sleep(3600)  # run hourly, but only writes once/day
        try:
            today = datetime.utcnow().strftime("%Y-%m-%d")
            # Check if we already summarized today
            existing = None
            async with aiosqlite.connect(str(MEMORY_DB)) as db:
                db.row_factory = aiosqlite.Row
                cur = await db.execute(
                    "SELECT value FROM memory WHERE key=? AND user_id=0",
                    (f"conversation_summary_{today}",))
                existing = await cur.fetchone()

            if existing:
                continue  # already done today

            # Get conversations from last 24h
            db = await get_db()
            rows = await fetchall(db,
                "SELECT role, content, timestamp FROM conversations "
                "WHERE timestamp > datetime('now', '-24 hours') "
                "ORDER BY id ASC LIMIT 50")
            await db.close()

            if len(rows) < 3:
                continue  # not enough to summarize

            # Build summary prompt
            convo_text = "\n".join([
                f"{r['role'].upper()}: {r['content'][:300]}" for r in rows])
            summary_prompt = (
                f"Summarize these conversations in 3-5 bullet points. "
                f"Focus on: decisions made, things Christian asked for, preferences revealed, "
                f"business context learned. Be extremely concise.\n\n{convo_text}"
            )

            env = os.environ.copy()
            for key in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
                env.pop(key, None)

            proc = await asyncio.create_subprocess_exec(
                CLAUDE_CLI, "-p", summary_prompt,
                "--model", "haiku",
                "--output-format", "text",
                "--no-session-persistence",
                "--dangerously-skip-permissions",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
            summary = stdout.decode().strip()

            if summary and len(summary) > 20:
                await save_memory(f"conversation_summary_{today}", summary)
                logger.info(f"Saved conversation summary for {today}")

        except Exception as e:
            logger.warning(f"summarize_conversations error: {e}")

# ── Pre-Meeting Briefing Monitor ──────────────────────────────────────────────

async def pre_meeting_monitor():
    """Every 2 minutes, check for meetings starting in 10-15 minutes. Generate and push a brief."""
    global _briefed_events
    await asyncio.sleep(30)
    while True:
        try:
            from datetime import timedelta as _td, timezone as _tz
            phoenix_tz = _tz(_td(hours=-7))
            now = datetime.now(phoenix_tz)

            # Get calendar events for today
            output = await run_script([
                sys.executable, "-W", "ignore",
                str(SCRIPTS_DIR / "google_helper.py"), "calendar_today", "0"
            ])
            if output and "No events" not in output:
                for line in output.split("\n"):
                    line = line.strip()
                    if "|" not in line or line.startswith("\U0001f4c5") or line.startswith("\U0001f4cd"):
                        continue
                    parts = line.split("|", 1)
                    time_part = parts[0].strip()
                    title = parts[1].strip() if len(parts) > 1 else ""
                    if not title:
                        continue

                    # Parse time like "09:00 AM-10:00 AM"
                    try:
                        start_str = re.split(r'\s*-\s*', time_part)[0].strip()
                        event_time = datetime.strptime(start_str, "%I:%M %p").replace(
                            year=now.year, month=now.month, day=now.day,
                            tzinfo=phoenix_tz
                        )
                    except Exception:
                        continue

                    minutes_until = (event_time - now).total_seconds() / 60
                    event_key = f"{now.date()}_{title}_{start_str}"

                    if 5 <= minutes_until <= 15 and event_key not in _briefed_events:
                        _briefed_events.add(event_key)
                        logger.info(f"Pre-meeting brief triggered for: {title}")

                        brief_parts = [f"**Pre-Meeting Brief: {title}**", f"Starts at {time_part}"]

                        # Search emails related to this meeting
                        try:
                            email_output = await run_script([
                                sys.executable, "-W", "ignore",
                                str(SCRIPTS_DIR / "google_helper.py"),
                                "gmail_search", title, "3"
                            ], timeout=10)
                            if email_output and "No emails" not in email_output:
                                brief_parts.append(f"\n**Recent related emails:**\n{email_output[:500]}")
                        except Exception:
                            pass

                        # Search RAG for relevant context
                        try:
                            chunks = await retrieve_relevant_chunks(title, limit=2)
                            if chunks:
                                brief_parts.append("\n**Related documents:**")
                                for c in chunks:
                                    brief_parts.append(f"- [{c['filename']}]: {c['content'][:150]}")
                        except Exception:
                            pass

                        # Check pending actions related to the meeting
                        try:
                            db = await get_db()
                            actions = await fetchall(db,
                                "SELECT title, description FROM action_items WHERE status='pending' AND (title LIKE ? OR description LIKE ?) LIMIT 3",
                                (f"%{title[:30]}%", f"%{title[:30]}%"))
                            await db.close()
                            if actions:
                                brief_parts.append("\n**Open action items:**")
                                for a in actions:
                                    brief_parts.append(f"- {a['title']}")
                        except Exception:
                            pass

                        brief_text = "\n".join(brief_parts)
                        await manager.broadcast({
                            "type": "proactive_message",
                            "message": brief_text,
                            "urgency": "high"
                        })

                        # Save to conversations
                        try:
                            db = await get_db()
                            await db.execute(
                                "INSERT INTO conversations (role, content, metadata) VALUES (?,?,?)",
                                ("assistant", brief_text, json.dumps({"source": "pre_meeting_brief"})))
                            await db.commit()
                            await db.close()
                        except Exception:
                            pass

        except Exception as e:
            logger.warning(f"pre_meeting_monitor error: {e}")

        await asyncio.sleep(120)  # every 2 minutes


async def end_of_day_summary():
    """At 5:00 PM local time, generate and push an end-of-day summary (once per day)."""
    global _eod_date
    await asyncio.sleep(60)
    while True:
        try:
            from datetime import timedelta as _td, timezone as _tz
            phoenix_tz = _tz(_td(hours=-7))
            now = datetime.now(phoenix_tz)
            today_str = now.strftime("%Y-%m-%d")

            if now.hour == 17 and now.minute < 5 and _eod_date != today_str:
                _eod_date = today_str
                logger.info("End-of-day summary triggered")

                summary_parts = [f"**End-of-Day Summary - {now.strftime('%A, %B %d')}**\n"]

                # Completed tasks/actions today
                try:
                    db = await get_db()
                    completed = await fetchall(db,
                        "SELECT title FROM action_items WHERE status IN ('approved','completed') AND date(resolved_at)=date('now') LIMIT 10")
                    if completed:
                        summary_parts.append("**Completed today:**")
                        for c in completed:
                            summary_parts.append(f"- {c['title']}")
                    else:
                        summary_parts.append("**Completed today:** None tracked")

                    # Still open
                    pending = await fetchall(db,
                        "SELECT title, priority FROM action_items WHERE status='pending' ORDER BY CASE priority WHEN 'HIGH' THEN 0 WHEN 'MED' THEN 1 ELSE 2 END LIMIT 8")
                    if pending:
                        summary_parts.append("\n**Still open:**")
                        for p in pending:
                            flag = "\U0001f534" if p["priority"] == "HIGH" else "\U0001f7e1" if p["priority"] == "MED" else "\u26aa"
                            summary_parts.append(f"- {flag} {p['title']}")

                    # Unread high-priority messages
                    unread_high = await fetchall(db,
                        "SELECT sender, subject FROM messages WHERE read=0 AND priority='HIGH' LIMIT 5")
                    if unread_high:
                        summary_parts.append("\n**Unread high-priority:**")
                        for m in unread_high:
                            summary_parts.append(f"- From {m['sender']}: {m['subject']}")

                    await db.close()
                except Exception as e:
                    logger.warning(f"EOD summary db error: {e}")

                # Tomorrow's calendar
                try:
                    cal_output = await run_script([
                        sys.executable, "-W", "ignore",
                        str(SCRIPTS_DIR / "google_helper.py"), "calendar_today", "1"
                    ], timeout=15)
                    if cal_output and "No events" not in cal_output:
                        summary_parts.append(f"\n**Tomorrow's calendar:**\n{cal_output[:500]}")
                    else:
                        summary_parts.append("\n**Tomorrow's calendar:** No events scheduled")
                except Exception:
                    pass

                summary_text = "\n".join(summary_parts)
                await manager.broadcast({
                    "type": "proactive_message",
                    "message": summary_text,
                    "urgency": "normal"
                })

                # Save to conversations
                try:
                    db = await get_db()
                    await db.execute(
                        "INSERT INTO conversations (role, content, metadata) VALUES (?,?,?)",
                        ("assistant", summary_text, json.dumps({"source": "eod_summary"})))
                    await db.commit()
                    await db.close()
                except Exception:
                    pass

        except Exception as e:
            logger.warning(f"end_of_day_summary error: {e}")

        await asyncio.sleep(60)  # check every minute

# ── Data Ingester ─────────────────────────────────────────────────────────────

LAST_INGESTION: dict = {"time": None, "results": {}}

class DataIngester:
    def __init__(self):
        self.scripts = SCRIPTS_DIR

    async def _run(self, cmd: list, timeout: int = 30) -> str:
        env = os.environ.copy()
        for key in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
            env.pop(key, None)
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return stdout.decode(errors="replace").strip()
        except asyncio.TimeoutError:
            logger.warning(f"Ingestion timeout: {cmd[0]}")
            return ""
        except Exception as e:
            logger.warning(f"Ingestion error ({cmd[0]}): {e}")
            return ""

    async def ingest_gmail(self) -> int:
        output = await self._run(
            [sys.executable, "-W", "ignore",
             str(self.scripts / "google_helper.py"), "gmail_unread", "25"],
            timeout=30,
        )
        if not output:
            return 0
        count = 0
        db = await get_db()
        try:
            blocks = re.split(r"\n(?=📩)", output)
            for block in blocks:
                lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
                if not lines or not lines[0].startswith("📩"):
                    continue
                sender = subject = msg_id = ""
                content_parts = []
                for line in lines[1:]:
                    if line.startswith("From:"):
                        sender = line[5:].strip()
                    elif line.startswith("Subject:"):
                        subject = line[8:].strip()
                    elif line.startswith("[ID:") and line.endswith("]"):
                        msg_id = line[4:-1].strip()
                    else:
                        content_parts.append(line)
                if not msg_id:
                    continue
                existing = await fetchone(
                    db, "SELECT id FROM messages WHERE metadata LIKE ?",
                    (f'%{msg_id}%',),
                )
                if existing:
                    continue
                content = " ".join(content_parts)
                priority = classify_priority(sender, content, subject)
                await db.execute(
                    "INSERT INTO messages (source,sender,subject,content,priority,metadata) VALUES (?,?,?,?,?,?)",
                    ("gmail", sender, subject, content, priority, json.dumps({"gmail_id": msg_id})),
                )
                count += 1
            await db.commit()
        finally:
            await db.close()
        return count

    async def ingest_imessages(self) -> int:
        output = await self._run(
            [str(self.scripts / "get_recent_imessages.sh"), "30"], timeout=15
        )
        if not output:
            return 0
        count = 0
        db = await get_db()
        try:
            for line in output.split("\n"):
                parts = line.strip().split("|", 2)
                if len(parts) < 3:
                    continue
                timestamp, sender, text = parts
                if sender.strip() == "Me" or not text.strip():
                    continue
                existing = await fetchone(
                    db,
                    "SELECT id FROM messages WHERE source='imessage' AND sender=? AND content=?",
                    (sender.strip(), text.strip()),
                )
                if existing:
                    continue
                priority = classify_priority(sender, text)
                await db.execute(
                    "INSERT INTO messages (source,sender,content,priority,timestamp) VALUES (?,?,?,?,?)",
                    ("imessage", sender.strip(), text.strip(), priority, timestamp.strip()),
                )
                count += 1
            await db.commit()
        finally:
            await db.close()
        return count

    async def ingest_calendar(self) -> int:
        output = await self._run(
            [sys.executable, "-W", "ignore",
             str(self.scripts / "google_helper.py"), "calendar_today", "3"],
            timeout=20,
        )
        if not output:
            return 0
        count = 0
        db = await get_db()
        current_date = ""
        try:
            for line in output.split("\n"):
                stripped = line.strip()
                if not stripped:
                    continue
                if stripped.startswith("📅"):
                    current_date = stripped[2:].strip()
                    continue
                if "|" in stripped and not stripped.startswith("📍"):
                    parts = stripped.split("|", 1)
                    time_part = parts[0].strip()
                    title = parts[1].strip() if len(parts) > 1 else stripped
                    subject = f"{title} ({current_date} {time_part})"
                    existing = await fetchone(
                        db,
                        "SELECT id FROM messages WHERE source='calendar' AND subject=?",
                        (subject,),
                    )
                    if existing:
                        continue
                    priority = classify_priority(content=title, subject=title)
                    await db.execute(
                        "INSERT INTO messages (source,sender,subject,content,priority) VALUES (?,?,?,?,?)",
                        ("calendar", "Calendar", subject, title, priority),
                    )
                    count += 1
            await db.commit()
        finally:
            await db.close()
        return count

    async def run_all(self) -> dict:
        results = await asyncio.gather(
            self.ingest_gmail(),
            self.ingest_imessages(),
            self.ingest_calendar(),
            return_exceptions=True,
        )
        labels = ["gmail", "imessage", "calendar"]
        out = {}
        for label, r in zip(labels, results):
            if isinstance(r, int):
                out[label] = r
            else:
                logger.warning(f"Ingestion [{label}] raised: {r}")
                out[label] = 0
        return out

async def background_ingestion():
    await asyncio.sleep(10)
    ingester = DataIngester()
    while True:
        try:
            results = await ingester.run_all()
            total = sum(results.values())
            LAST_INGESTION["time"] = datetime.now().isoformat()
            LAST_INGESTION["results"] = results
            if total > 0:
                logger.info(f"Ingested {total} new items: {results}")
                await manager.broadcast({"type": "new_messages", "count": total, "sources": results})
                # Evaluate standing orders against newly ingested messages
                try:
                    db = await get_db()
                    recent = await fetchall(db,
                        "SELECT sender, subject, content FROM messages ORDER BY id DESC LIMIT ?",
                        (total,))
                    await db.close()
                    for msg in recent:
                        await evaluate_standing_orders(
                            msg["content"] or "", msg["sender"] or "", msg["subject"] or "")
                except Exception as so_err:
                    logger.warning(f"Standing order eval after ingestion: {so_err}")
        except Exception as e:
            logger.error(f"Background ingestion error: {e}")
        await asyncio.sleep(600)  # every 10 minutes

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    await asyncio.gather(init_db(), init_memory_db(), init_journal_db())
    asyncio.create_task(background_scanner())
    asyncio.create_task(heartbeat_monitor())
    asyncio.create_task(background_ingestion())
    asyncio.create_task(summarize_conversations_to_memory())
    asyncio.create_task(pre_meeting_monitor())
    asyncio.create_task(end_of_day_summary())

# ── API: System ───────────────────────────────────────────────────────────────

@app.get("/api/heartbeat")
async def get_heartbeat():
    return HEARTBEAT_DATA

@app.get("/api/stats")
async def get_stats():
    db = await get_db()
    pending      = await fetchone(db, "SELECT COUNT(*) as c FROM action_items WHERE status='pending'")
    approved     = await fetchone(db, "SELECT COUNT(*) as c FROM action_items WHERE status='approved' AND date(resolved_at)=date('now')")
    high_msgs    = await fetchone(db, "SELECT COUNT(*) as c FROM messages WHERE priority='HIGH' AND date(timestamp)=date('now')")
    unread_notif = await fetchone(db, "SELECT COUNT(*) as c FROM notifications WHERE read=0")
    active_tools = await fetchone(db, "SELECT COUNT(*) as c FROM tools WHERE enabled=1")
    await db.close()
    return {
        "pending_actions":     pending["c"],
        "approved_today":      approved["c"],
        "high_priority_today": high_msgs["c"],
        "unread_notifications":unread_notif["c"],
        "active_tools":        active_tools["c"],
    }

@app.post("/api/refresh")
async def refresh_data():
    ingester = DataIngester()
    results = await ingester.run_all()
    total = sum(results.values())
    LAST_INGESTION["time"] = datetime.now().isoformat()
    LAST_INGESTION["results"] = results
    if total > 0:
        await manager.broadcast({"type": "new_messages", "count": total, "sources": results})
    return {"ingested": total, "sources": results, "timestamp": LAST_INGESTION["time"]}

@app.get("/api/refresh")
async def get_refresh_status():
    return {"last_ingestion": LAST_INGESTION}

@app.get("/api/journal")
async def get_journal(limit: int = 100):
    try:
        async with aiosqlite.connect(str(JOURNAL_DB)) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM activity_log ORDER BY id DESC LIMIT ?", (limit,))
            rows = await cur.fetchall()
        return {"entries": [dict(r) for r in rows]}
    except Exception as e:
        logger.warning(f"get_journal error: {e}")
        return {"entries": []}

# ── API: Cancel active Claude response ───────────────────────────────────────

@app.post("/api/cancel")
async def cancel_response():
    """Kill the active Claude subprocess and notify the browser."""
    proc = _active_proc.get("proc")
    ws   = _active_proc.get("ws")
    if proc and proc.returncode is None:
        try:
            proc.kill()
        except Exception:
            pass
    _active_proc["proc"] = None
    _active_proc["ws"]   = None
    if ws:
        try:
            await ws.send_json({"type": "chat_cancelled"})
        except Exception:
            pass
    return {"cancelled": True}

# ── API: Heartbeat alert push (used by heartbeat.py) ─────────────────────────

@app.post("/api/alert")
async def push_alert(request: Request):
    """heartbeat.py POSTs here to push proactive alerts to all connected clients."""
    data = await request.json()
    title   = data.get("title", "AntiGravity")
    body    = data.get("body", "")
    urgency = data.get("urgency", "normal")

    # Persist as notification so it shows up even if no clients are connected
    db = await get_db()
    await db.execute(
        "INSERT INTO notifications (title, body, type) VALUES (?,?,?)",
        (title, body, "alert" if urgency == "high" else "info"))
    await db.commit()
    await db.close()

    # Push toast to any connected browsers
    await manager.broadcast({
        "type": "toast",
        "title": title,
        "body": body,
        "urgency": urgency,
    })
    await log_activity("heartbeat", "alert", f"{title}: {body[:100]}")
    return {"status": "sent", "clients": len(manager.connections)}

# ── API: Messages ─────────────────────────────────────────────────────────────

@app.get("/api/messages")
async def get_messages(limit: int = 50, source: str = None,
                       search: str = None, priority: str = None,
                       show_spam: bool = False):
    db = await get_db()
    query, params, conditions = "SELECT * FROM messages", [], []
    if source == "spam":
        conditions.append("spam=1")
    else:
        if source:
            conditions.append("source = ?"); params.append(source)
        if not show_spam:
            conditions.append("(spam=0 OR spam IS NULL)")
    if priority:
        conditions.append("priority = ?"); params.append(priority)
    if search:
        conditions.append("id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)")
        params.append(search)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)
    rows = await fetchall(db, query, params)
    await db.close()
    messages = []
    for r in rows:
        m = dict(r)
        m["score"] = score_message(m)
        messages.append(m)
    return {"messages": messages, "count": len(messages)}

@app.post("/api/messages")
async def create_message(request: Request):
    data = await request.json()
    priority = classify_priority(
        data.get("sender", ""), data.get("content", ""), data.get("subject", ""))
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO messages (source, sender, subject, content, priority, metadata) VALUES (?,?,?,?,?,?)",
        (data.get("source", "unknown"), data.get("sender", ""), data.get("subject", ""),
         data.get("content", ""), priority, json.dumps(data.get("metadata", {}))))
    msg_id = cursor.lastrowid
    await db.commit()
    await db.close()
    await manager.broadcast({"type": "new_message", "message": {**data, "id": msg_id, "priority": priority}})
    # Evaluate standing orders against this new message
    await evaluate_standing_orders(
        data.get("content", ""), data.get("sender", ""), data.get("subject", ""))
    return {"id": msg_id, "priority": priority}

@app.post("/api/messages/{msg_id}/spam")
async def mark_spam(msg_id: int):
    """Mark a message as spam and learn the sender pattern."""
    db = await get_db()
    msg = await fetchone(db, "SELECT sender, subject FROM messages WHERE id=?", (msg_id,))
    if not msg:
        await db.close()
        raise HTTPException(status_code=404, detail="Message not found")
    await db.execute("UPDATE messages SET spam=1, priority='LOW' WHERE id=?", (msg_id,))
    # Extract domain from sender email for pattern learning
    sender = msg["sender"] or ""
    import re as _re
    domain_match = _re.search(r'@([\w.\-]+)', sender)
    if domain_match:
        domain = domain_match.group(1).lower()
        try:
            await db.execute(
                "INSERT INTO spam_rules (pattern, pattern_type) VALUES (?,?) "
                "ON CONFLICT(pattern, pattern_type) DO UPDATE SET match_count=match_count+1",
                (domain, "domain")
            )
        except Exception:
            pass
    elif sender.strip():
        try:
            await db.execute(
                "INSERT INTO spam_rules (pattern, pattern_type) VALUES (?,?) "
                "ON CONFLICT(pattern, pattern_type) DO UPDATE SET match_count=match_count+1",
                (sender.lower(), "sender")
            )
        except Exception:
            pass
    await db.commit()
    await db.close()
    return {"ok": True, "learned": sender}

@app.post("/api/messages/{msg_id}/not-spam")
async def mark_not_spam(msg_id: int):
    """Mark a message as not spam (undo)."""
    db = await get_db()
    await db.execute("UPDATE messages SET spam=0 WHERE id=?", (msg_id,))
    await db.commit()
    await db.close()
    return {"ok": True}

@app.post("/api/messages/{msg_id}/unsubscribe")
async def unsubscribe_message(msg_id: int):
    """Find and click the unsubscribe link in an email, then mark as spam."""
    db = await get_db()
    msg = await fetchone(db, "SELECT sender, subject, content, metadata FROM messages WHERE id=?", (msg_id,))
    if not msg:
        await db.close()
        raise HTTPException(status_code=404, detail="Message not found")
    await db.close()
    content = msg["content"] or ""
    subject = msg["subject"] or ""
    sender  = msg["sender"]  or ""
    # Ask Claude to find + action the unsubscribe link
    prompt = (
        f"Find the unsubscribe link in this email and open it in the browser to unsubscribe. "
        f"If there's no clickable link, reply with the word NOLINK only.\n\n"
        f"From: {sender}\nSubject: {subject}\nContent:\n{content[:2000]}"
    )
    result = await bot_respond(prompt)
    # Also mark as spam regardless
    db2 = await get_db()
    await db2.execute("UPDATE messages SET spam=1 WHERE id=?", (msg_id,))
    await db2.commit()
    await db2.close()
    return {"ok": True, "result": result or "Unsubscribe attempted"}

# ── API: Action Items ─────────────────────────────────────────────────────────

@app.get("/api/actions")
async def get_actions(status: str = "pending", limit: int = 50):
    db = await get_db()
    rows = await fetchall(db, """
        SELECT a.*, m.sender, m.source, m.subject as msg_subject
        FROM action_items a LEFT JOIN messages m ON a.source_msg_id = m.id
        WHERE a.status = ?
        ORDER BY CASE a.priority WHEN 'HIGH' THEN 0 WHEN 'MED' THEN 1 ELSE 2 END,
                 a.created_at DESC
        LIMIT ?
    """, (status, limit))
    await db.close()
    return {"actions": [dict(r) for r in rows], "count": len(rows)}

@app.post("/api/actions/{action_id}/approve")
async def approve_action(action_id: int, request: Request):
    data = {}
    if request.headers.get("content-type", "").startswith("application/json"):
        data = await request.json()
    db = await get_db()
    action = await fetchone(db, "SELECT * FROM action_items WHERE id = ?", (action_id,))
    if not action:
        await db.close()
        raise HTTPException(404, "Action not found")
    await db.execute(
        "UPDATE action_items SET status='approved', resolved_at=datetime('now'), resolved_by='user' WHERE id=?",
        (action_id,))
    await db.execute(
        "INSERT INTO conversations (role, content, action_item_id) VALUES ('system', ?, ?)",
        (f"Approved: {action['title']}", action_id))
    await db.commit()
    await db.close()
    await manager.broadcast({"type": "action_resolved", "id": action_id, "status": "approved"})
    return {"status": "approved"}

@app.post("/api/actions/{action_id}/reject")
async def reject_action(action_id: int):
    db = await get_db()
    await db.execute(
        "UPDATE action_items SET status='rejected', resolved_at=datetime('now'), resolved_by='user' WHERE id=?",
        (action_id,))
    await db.commit()
    await db.close()
    await manager.broadcast({"type": "action_resolved", "id": action_id, "status": "rejected"})
    return {"status": "rejected"}

@app.post("/api/actions/{action_id}/edit")
async def edit_action(action_id: int, request: Request):
    data = await request.json()
    db = await get_db()
    await db.execute(
        "UPDATE action_items SET suggested_content=? WHERE id=?",
        (data.get("content", ""), action_id))
    await db.commit()
    await db.close()
    return {"status": "updated"}

# ── API: Tools / Agents / Skills ─────────────────────────────────────────────

@app.get("/api/tools")
async def get_tools(type: str = None, enabled_only: bool = False):
    db = await get_db()
    query, conditions, params = "SELECT * FROM tools", [], []
    if type:
        conditions.append("type = ?"); params.append(type)
    if enabled_only:
        conditions.append("enabled = 1")
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY type, name"
    rows = await fetchall(db, query, params)
    await db.close()
    return {"tools": [dict(r) for r in rows]}

@app.get("/api/tools/{tool_id}")
async def get_tool(tool_id: int):
    db = await get_db()
    tool = await fetchone(db, "SELECT * FROM tools WHERE id = ?", (tool_id,))
    if not tool:
        await db.close()
        raise HTTPException(404, "Tool not found")
    logs = await fetchall(db,
        "SELECT * FROM tool_logs WHERE tool_id = ? ORDER BY timestamp DESC LIMIT 20",
        (tool_id,))
    await db.close()
    return {"tool": dict(tool), "logs": [dict(l) for l in logs]}

@app.post("/api/tools")
async def create_tool(request: Request):
    data = await request.json()
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO tools (name, type, description, icon, config, version, author, capabilities) VALUES (?,?,?,?,?,?,?,?)",
        (data["name"], data.get("type", "tool"), data.get("description", ""),
         data.get("icon", "🔧"), json.dumps(data.get("config", {})),
         data.get("version", "1.0.0"), data.get("author", "user"),
         json.dumps(data.get("capabilities", []))))
    tool_id = cursor.lastrowid
    await db.commit()
    await db.close()
    await manager.broadcast({"type": "tool_added", "id": tool_id, "name": data["name"]})
    return {"id": tool_id}

@app.put("/api/tools/{tool_id}")
async def update_tool(tool_id: int, request: Request):
    data = await request.json()
    db = await get_db()
    sets, params = [], []
    for field in ["name", "description", "icon", "enabled", "version"]:
        if field in data:
            sets.append(f"{field} = ?"); params.append(data[field])
    if "config" in data:
        sets.append("config = ?"); params.append(json.dumps(data["config"]))
    if "capabilities" in data:
        sets.append("capabilities = ?"); params.append(json.dumps(data["capabilities"]))
    sets.append("updated_at = datetime('now')")
    params.append(tool_id)
    await db.execute(f"UPDATE tools SET {', '.join(sets)} WHERE id = ?", params)
    await db.commit()
    await db.close()
    return {"status": "updated"}

@app.post("/api/tools/{tool_id}/toggle")
async def toggle_tool(tool_id: int):
    db = await get_db()
    tool = await fetchone(db, "SELECT enabled FROM tools WHERE id = ?", (tool_id,))
    if not tool:
        await db.close()
        raise HTTPException(404, "Tool not found")
    new_state = 0 if tool["enabled"] else 1
    await db.execute(
        "UPDATE tools SET enabled=?, updated_at=datetime('now') WHERE id=?",
        (new_state, tool_id))
    await db.commit()
    await db.close()
    await manager.broadcast({"type": "tool_toggled", "id": tool_id, "enabled": bool(new_state)})
    return {"enabled": bool(new_state)}

@app.post("/api/tools/{tool_id}/execute")
async def execute_tool(tool_id: int, request: Request):
    """Execute a tool/agent/skill manually via Claude CLI."""
    data = await request.json()
    db = await get_db()
    tool = await fetchone(db, "SELECT * FROM tools WHERE id = ?", (tool_id,))
    if not tool:
        await db.close()
        raise HTTPException(404, "Tool not found")
    if not tool["enabled"]:
        await db.close()
        raise HTTPException(400, "Tool is disabled")

    tool_dict = dict(tool)
    input_text = data.get("input", "")
    start_time = time.time()

    try:
        prompt = (
            f'You are executing the "{tool_dict["name"]}" tool.\n'
            f'Description: {tool_dict["description"]}\n'
            f'User input: {input_text}\n'
            f'Execute the tool\'s function and return the result.'
        )
        proc = await asyncio.create_subprocess_exec(
            CLAUDE_CLI, "-p", prompt, "--max-turns", "3",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        result = stdout.decode().strip() if stdout else "No output"
        success = True
    except Exception as e:
        result = f"Error: {e}"
        success = False

    duration = int((time.time() - start_time) * 1000)
    await db.execute(
        "INSERT INTO tool_logs (tool_id, action, input, output, success, duration_ms) VALUES (?, 'execute', ?, ?, ?, ?)",
        (tool_id, input_text[:500], result[:1000], 1 if success else 0, duration))
    await db.execute(
        "UPDATE tools SET last_used=datetime('now'), usage_count=usage_count+1 WHERE id=?",
        (tool_id,))
    await db.commit()
    await db.close()
    return {"result": result, "success": success, "duration_ms": duration}

@app.delete("/api/tools/{tool_id}")
async def delete_tool(tool_id: int):
    db = await get_db()
    await db.execute("DELETE FROM tool_logs WHERE tool_id = ?", (tool_id,))
    await db.execute("DELETE FROM tools WHERE id = ?", (tool_id,))
    await db.commit()
    await db.close()
    return {"status": "deleted"}

# ── API: Conversations ────────────────────────────────────────────────────────

@app.get("/api/conversations")
async def get_conversations(limit: int = 100):
    db = await get_db()
    rows = await fetchall(db,
        "SELECT * FROM conversations ORDER BY timestamp ASC LIMIT ?", (limit,))
    await db.close()
    return {"messages": [dict(r) for r in rows]}

# ── API: Notifications ────────────────────────────────────────────────────────

@app.get("/api/notifications")
async def get_notifications(unread_only: bool = True, limit: int = 50):
    db = await get_db()
    query = "SELECT * FROM notifications"
    if unread_only:
        query += " WHERE read = 0"
    query += " ORDER BY created_at DESC LIMIT ?"
    rows = await fetchall(db, query, (limit,))
    await db.close()
    return {"notifications": [dict(r) for r in rows], "count": len(rows)}

@app.post("/api/notifications/read")
async def mark_notifications_read(request: Request):
    data = await request.json()
    db = await get_db()
    ids = data.get("ids", [])
    if ids:
        ph = ",".join("?" * len(ids))
        await db.execute(f"UPDATE notifications SET read=1 WHERE id IN ({ph})", ids)
    else:
        await db.execute("UPDATE notifications SET read=1")
    await db.commit()
    await db.close()
    return {"status": "ok"}

# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Send current state immediately on connect
        await ws.send_json({"type": "heartbeat", "data": HEARTBEAT_DATA})

        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "chat":
                message = data.get("message", "").strip()
                if not message:
                    continue
                db = await get_db()
                await db.execute(
                    "INSERT INTO conversations (role, content) VALUES ('user', ?)", (message,))
                await db.commit()
                await db.close()

                response = await bot_respond(message, ws=ws)

                db = await get_db()
                await db.execute(
                    "INSERT INTO conversations (role, content) VALUES ('assistant', ?)", (response,))
                await db.commit()
                await db.close()

                await log_activity("dashboard", "chat",
                    f"User: {message[:80]}", f"Response: {response[:200]}")
                await ws.send_json({
                    "type": "chat_response",
                    "message": response,
                    "timestamp": datetime.now().isoformat(),
                })

            elif msg_type == "voice_chat":
                transcript = data.get("transcript", "").strip()
                if not transcript:
                    continue
                db = await get_db()
                await db.execute(
                    "INSERT INTO conversations (role, content, metadata) VALUES ('user', ?, ?)",
                    (transcript, json.dumps({"source": "voice"})))
                await db.commit()
                await db.close()

                response = await bot_respond(transcript, ws=ws)

                db = await get_db()
                await db.execute(
                    "INSERT INTO conversations (role, content, metadata) VALUES ('assistant', ?, ?)",
                    (response, json.dumps({"source": "voice"})))
                await db.commit()
                await db.close()

                await ws.send_json({
                    "type": "voice_response",
                    "message": response,
                    "timestamp": datetime.now().isoformat(),
                })

            elif msg_type == "ping":
                await ws.send_json({"type": "pong", "timestamp": datetime.now().isoformat()})

    except WebSocketDisconnect:
        manager.disconnect(ws)

# ── PWA Assets ────────────────────────────────────────────────────────────────

@app.get("/manifest.json")
async def manifest():
    return JSONResponse({
        "name": "AntiGravity",
        "short_name": "AG",
        "description": "Executive AI Command Center",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0a0a0a",
        "theme_color": "#22d3ee",
        "orientation": "any",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        ],
    })

@app.get("/sw.js")
async def service_worker():
    return HTMLResponse("""
const CACHE = 'ag-v3';
const PRECACHE = ['/', '/manifest.json', '/icon-192.png'];
self.addEventListener('install', e => e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))));
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(
        keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
self.addEventListener('push', e => {
    const d = e.data ? e.data.json() : {title: 'AntiGravity', body: 'New notification'};
    e.waitUntil(self.registration.showNotification(d.title, {
        body: d.body, icon: '/icon-192.png', badge: '/icon-192.png',
        data: d.url || '/', vibrate: [200, 100, 200],
        actions: [{action:'view',title:'View'},{action:'dismiss',title:'Dismiss'}]
    }));
});
self.addEventListener('notificationclick', e => {
    e.notification.close();
    if (e.action === 'dismiss') return;
    e.waitUntil(clients.openWindow(e.notification.data));
});
""", media_type="application/javascript")

@app.get("/icon-192.png")
async def icon_192():
    p = STATIC_DIR / "icon-192.png"
    if p.exists():
        return FileResponse(p, media_type="image/png")
    raise HTTPException(404)

@app.get("/icon-512.png")
async def icon_512():
    p = STATIC_DIR / "icon-512.png"
    if p.exists():
        return FileResponse(p, media_type="image/png")
    raise HTTPException(404)

# ── API: Briefing + Intelligence ──────────────────────────────────────────────

@app.get("/api/briefing")
async def get_briefing():
    """Generate the morning Urgent/Important/FYI briefing from current data."""
    db = await get_db()
    try:
        # Get recent messages (last 24h)
        rows = await fetchall(db, """
            SELECT * FROM messages
            WHERE timestamp > datetime('now', '-24 hours')
            ORDER BY timestamp DESC LIMIT 100
        """)
        messages = [dict(r) for r in rows]

        # Get pending action items
        action_rows = await fetchall(db, """
            SELECT a.*, m.sender, m.source, m.content as msg_content
            FROM action_items a
            LEFT JOIN messages m ON m.id = a.source_msg_id
            WHERE a.status = 'pending'
            ORDER BY CASE a.priority WHEN 'HIGH' THEN 0 WHEN 'MED' THEN 1 ELSE 2 END, a.created_at DESC
            LIMIT 20
        """)
        actions = [dict(r) for r in action_rows]

    finally:
        await db.close()

    now = datetime.now()
    hour = now.hour

    if hour < 12: greeting_time = "morning"
    elif hour < 17: greeting_time = "afternoon"
    else: greeting_time = "evening"

    # Get user name from memory
    memories = await get_memories()
    user_name = "Christian"
    for m in memories:
        if m["key"] == "user_name":
            user_name = m["value"].split()[0]
            break

    # Score and categorize
    urgent = []
    important = []
    fyi = []

    for msg in messages:
        score = score_message(msg)
        item = {
            "id": msg["id"],
            "source": msg.get("source"),
            "sender": msg.get("sender"),
            "subject": msg.get("subject"),
            "content": (msg.get("content") or "")[:200],
            "timestamp": msg.get("timestamp"),
            "score": score,
            "priority": msg.get("priority"),
        }
        if score >= 75:
            urgent.append(item)
        elif score >= 45:
            important.append(item)
        elif score >= 20:
            fyi.append(item)

    # Also add high-priority pending actions to urgent
    for action in actions:
        if action.get("priority") == "HIGH":
            urgent.insert(0, {
                "id": f"action_{action['id']}",
                "type": "action",
                "action_id": action["id"],
                "source": action.get("source") or action.get("type"),
                "sender": action.get("sender"),
                "subject": action.get("title"),
                "content": action.get("description"),
                "score": 90,
                "priority": "HIGH",
                "action_type": action.get("type"),
            })

    # Deduplicate and limit
    seen = set()
    def dedup(items, limit=5):
        result = []
        for item in sorted(items, key=lambda x: -x.get("score",0)):
            key = str(item.get("subject","")) + str(item.get("sender",""))
            if key not in seen:
                seen.add(key)
                result.append(item)
            if len(result) >= limit:
                break
        return result

    urgent = dedup(urgent, 3)
    important = dedup(important, 5)
    fyi_dedup = []
    for item in fyi:
        key = str(item.get("subject","")) + str(item.get("sender",""))
        if key not in seen:
            seen.add(key)
            fyi_dedup.append(item)
        if len(fyi_dedup) >= 6: break

    return JSONResponse({
        "greeting": f"Good {greeting_time}, {user_name}",
        "date": now.strftime("%A, %B %-d · %-I:%M %p"),
        "urgent": urgent,
        "important": important,
        "fyi": fyi_dedup,
        "total_messages": len(messages),
        "pending_actions": len(actions),
        "generated_at": now.isoformat(),
    })

@app.get("/api/messages/filtered")
async def get_filtered_messages(limit: int = 12):
    """Return top-scored messages that need the executive's attention."""
    db = await get_db()
    try:
        rows = await fetchall(db, """
            SELECT * FROM messages
            WHERE timestamp > datetime('now', '-48 hours')
            ORDER BY timestamp DESC LIMIT 200
        """)
        messages = [dict(r) for r in rows]
    finally:
        await db.close()

    # Score all messages and attach score to each
    scored = [(score_message(m), m) for m in messages]
    scored.sort(key=lambda x: -x[0])

    # Return top N with score embedded
    top = []
    for score, m in scored[:limit]:
        if score >= 20:
            m["score"] = score
            top.append(m)
    return JSONResponse({"messages": top, "total": len(messages), "filtered": len(top)})

@app.post("/api/actions/{action_id}/execute")
async def execute_action(action_id: int, request: Request):
    """Execute an approved action — actually sends email, creates reminder, etc."""
    body = await request.json()
    edited_content = body.get("content", "")

    db = await get_db()
    try:
        row = await fetchone(db, "SELECT * FROM action_items WHERE id=?", (action_id,))
        if not row:
            raise HTTPException(404, "Action not found")
        action = dict(row)

        # Mark as approved
        now = datetime.utcnow().isoformat()
        await db.execute(
            "UPDATE action_items SET status='approved', resolved_at=?, resolved_by='user' WHERE id=?",
            (now, action_id)
        )
        await db.commit()
    finally:
        await db.close()

    # Build execution prompt for Claude
    action_type = action.get("type", "reply")
    content = edited_content or action.get("suggested_content") or action.get("description") or ""
    title = action.get("title", "")

    if action_type == "reply" and content:
        exec_prompt = f"Execute this action immediately using your tools. Send this email reply: Subject: {title}. Content: {content}. Use gmail_send via google_helper.py. Report what you did."
    elif action_type == "schedule":
        exec_prompt = f"Execute this action immediately: Schedule this meeting: {title}. Details: {content}. Use create_calendar_event.sh or google_helper.py calendar_create. Report what you did."
    else:
        exec_prompt = f"Execute this action immediately: {title}. Details: {content}. Use whatever tools are appropriate. Report what you did."

    # Run Claude to execute
    result = await bot_respond(exec_prompt)

    await log_activity("dashboard", "action_executed", f"Executed: {title}", result)
    await manager.broadcast({"type": "action_resolved", "id": action_id, "status": "executed"})

    return JSONResponse({"success": True, "result": result, "action_id": action_id})

@app.get("/api/suggested-actions")
async def get_suggested_actions():
    """Return 3 contextual suggested actions based on current state."""
    db = await get_db()
    try:
        # Get most recent pending action
        pending = await fetchall(db, """
            SELECT a.*, m.sender, m.source
            FROM action_items a
            LEFT JOIN messages m ON m.id = a.source_msg_id
            WHERE a.status = 'pending'
            ORDER BY CASE a.priority WHEN 'HIGH' THEN 0 WHEN 'MED' THEN 1 ELSE 2 END
            LIMIT 3
        """)

        # Get next calendar event
        calendar_msg = await fetchone(db, """
            SELECT * FROM messages WHERE source='calendar'
            AND timestamp > datetime('now')
            ORDER BY timestamp ASC LIMIT 1
        """)

    finally:
        await db.close()

    suggestions = []

    if calendar_msg:
        suggestions.append({
            "label": f"Brief me for {(dict(calendar_msg).get('subject','next meeting'))[:30]}",
            "action": "brief_meeting",
            "icon": "📅",
            "prompt": f"Give me a quick pre-meeting brief for: {dict(calendar_msg).get('subject','my next meeting')}",
        })

    if pending:
        top = dict(pending[0])
        suggestions.append({
            "label": f"Handle: {(top.get('title','top priority'))[:25]}",
            "action": "handle_action",
            "icon": "⚡",
            "action_id": top.get("id"),
            "prompt": f"Help me handle this: {top.get('title')}. {top.get('description','')}",
        })

    suggestions.append({
        "label": "What needs my attention?",
        "action": "briefing",
        "icon": "🎯",
        "prompt": "What are the most important things that need my attention right now? Check my email, calendar, and messages.",
    })

    return JSONResponse({"actions": suggestions[:3]})

@app.post("/api/proactive-message")
async def post_proactive_message(request: Request):
    """Heartbeat posts proactive messages that appear in the chat feed."""
    body = await request.json()
    message = body.get("message", "")
    urgency = body.get("urgency", "normal")

    if not message:
        raise HTTPException(400, "message required")

    # Save to conversations as assistant message
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO conversations (role, content, metadata) VALUES (?,?,?)",
            ("assistant", message, json.dumps({"source": "heartbeat", "urgency": urgency}))
        )
        await db.commit()
    finally:
        await db.close()

    # Broadcast to all connected browsers
    await manager.broadcast({
        "type": "proactive_message",
        "message": message,
        "urgency": urgency,
    })

    return JSONResponse({"ok": True})

# ── API: Calendar ─────────────────────────────────────────────────────────────

@app.get("/api/calendar")
async def get_calendar(days: int = 7):
    """Get calendar events for next N days."""
    output = await run_script([
        sys.executable, "-W", "ignore",
        str(SCRIPTS_DIR / "google_helper.py"),
        "calendar_today", str(days)
    ])
    # Parse text output into structured events
    events = []
    current_date = None
    for line in output.split("\n"):
        line = line.strip()
        if line.startswith("📅"):
            current_date = line.replace("📅", "").strip()
        elif "|" in line and current_date:
            parts = line.split("|", 1)
            time_part = parts[0].strip()
            title = parts[1].strip() if len(parts) > 1 else ""
            events.append({"date": current_date, "time": time_part, "title": title, "location": ""})
        elif line.startswith("📍") and events:
            events[-1]["location"] = line.replace("📍", "").strip()
    return {"events": events, "raw": output}

@app.get("/api/calendar/range")
async def get_calendar_range(start: str, end: str):
    """Get calendar events between start and end date (YYYY-MM-DD)."""
    output = await run_script([
        sys.executable, "-W", "ignore",
        str(SCRIPTS_DIR / "google_helper.py"),
        "calendar_range", start, end
    ], timeout=30)
    events = []
    current_date = None
    for line in output.split("\n"):
        line = line.strip()
        if line.startswith("📅"):
            current_date = line.replace("📅", "").strip()
        elif "|" in line and current_date:
            parts = line.split("|", 1)
            time_part = parts[0].strip()
            title = parts[1].strip() if len(parts) > 1 else ""
            events.append({"date": current_date, "time": time_part, "title": title, "location": ""})
        elif line.startswith("📍") and events:
            events[-1]["location"] = line.replace("📍", "").strip()
    return {"events": events, "raw": output}

@app.post("/api/calendar")
async def create_calendar_event(body: dict):
    """Create a calendar event. Body: {summary, start_iso, end_iso, description?}"""
    summary = body.get("summary", "")
    start   = body.get("start_iso", "")
    end     = body.get("end_iso", "")
    desc    = body.get("description", "")
    if not summary or not start or not end:
        raise HTTPException(status_code=400, detail="summary, start_iso, end_iso required")
    cmd = [sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
           "calendar_create", summary, start, end]
    if desc:
        cmd.append(desc)
    output = await run_script(cmd)
    return {"ok": True, "result": output}

@app.get("/api/tasks")
async def get_tasks():
    """Get Google Tasks."""
    output = await run_script([
        sys.executable, "-W", "ignore",
        str(SCRIPTS_DIR / "google_helper.py"), "tasks_list"
    ])
    # Parse text output: "⬜ Task title (due: Jan 01)\n   [ID: abc123]"
    tasks = []
    current = None
    for line in output.split("\n"):
        if line.startswith("⬜") or line.startswith("✅"):
            done = line.startswith("✅")
            text = line[2:].strip()
            due = ""
            import re as _re
            due_match = _re.search(r'\(due: ([^)]+)\)', text)
            if due_match:
                due = due_match.group(1)
                text = text[:due_match.start()].strip()
            current = {"title": text, "done": done, "due": due, "id": "", "notes": ""}
            tasks.append(current)
        elif line.strip().startswith("[ID:") and current:
            current["id"] = line.strip()[5:-1].strip()
        elif line.strip().startswith("📝") and current:
            current["notes"] = line.strip()[2:].strip()
    return {"tasks": tasks}

@app.post("/api/tasks")
async def add_task(body: dict):
    """Add a Google Task. Body: {title, due_date?, list_name?}"""
    title = body.get("title", "")
    due   = body.get("due_date", "")
    list_name = body.get("list_name", "")
    if not title:
        raise HTTPException(status_code=400, detail="title required")
    cmd = [sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"), "tasks_add", title]
    if due:
        cmd.append(due)
    else:
        cmd.append("")  # placeholder for due_date positional arg
    if list_name:
        cmd.append(list_name)
    output = await run_script(cmd)
    return {"ok": True, "result": output}

@app.post("/api/tasks/{task_id}/complete")
async def complete_task(task_id: str):
    """Mark a Google Task as complete."""
    output = await run_script([
        sys.executable, "-W", "ignore",
        str(SCRIPTS_DIR / "google_helper.py"), "tasks_complete", task_id
    ])
    return {"ok": True, "result": output}

@app.get("/api/reminders")
async def get_reminders():
    """Get Apple Reminders."""
    output = await run_script([str(SCRIPTS_DIR / "get_reminders.sh")])
    return {"reminders": output, "raw": output}

@app.post("/api/reminders")
async def create_reminder(body: dict):
    """Create an Apple Reminder. Body: {title, list_name?, due_date?, notes?}"""
    title     = body.get("title", "")
    list_name = body.get("list_name", "Reminders")
    due_date  = body.get("due_date", "")
    notes     = body.get("notes", "")
    if not title:
        raise HTTPException(status_code=400, detail="title required")
    output = await run_script([
        str(SCRIPTS_DIR / "create_reminder.sh"),
        title, list_name, due_date, notes
    ])
    return {"ok": True, "result": output}

async def _apple_notes_push(title: str, content: str):
    """Fire-and-forget: push a note to Apple Notes for iCloud sync."""
    try:
        await asyncio.wait_for(
            run_script([sys.executable, "-W", "ignore",
                        str(SCRIPTS_DIR / "apple_notes.py"),
                        "create", title, content, "AntiGravity"]),
            timeout=8
        )
    except Exception:
        pass  # Silent fail — permission not yet granted

async def _apple_notes_delete(title: str):
    """Fire-and-forget: delete note from Apple Notes."""
    try:
        await asyncio.wait_for(
            run_script([sys.executable, "-W", "ignore",
                        str(SCRIPTS_DIR / "apple_notes.py"),
                        "delete", title]),
            timeout=8
        )
    except Exception:
        pass

@app.get("/api/notes")
async def get_notes(search: str = None, pinned: bool = False):
    """Return notes from SQLite (always fast). Apple Notes is write-sync only."""
    db = await get_db()
    if search:
        rows = await fetchall(db,
            "SELECT * FROM notes WHERE (title LIKE ? OR content LIKE ? OR tags LIKE ?) "
            "ORDER BY pinned DESC, updated_at DESC LIMIT 100",
            (f"%{search}%", f"%{search}%", f"%{search}%"))
    elif pinned:
        rows = await fetchall(db, "SELECT * FROM notes WHERE pinned=1 ORDER BY updated_at DESC")
    else:
        rows = await fetchall(db, "SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC LIMIT 100")
    await db.close()
    return {"notes": [dict(r) for r in rows]}

@app.post("/api/notes")
async def create_note(body: dict):
    """Create note in SQLite and push to Apple Notes in background (iCloud sync)."""
    title   = body.get("title", "")
    content = body.get("content", "")
    tags    = body.get("tags", "")
    if not content and not title:
        raise HTTPException(status_code=400, detail="title or content required")
    db = await get_db()
    cur = await db.execute(
        "INSERT INTO notes (title, content, tags) VALUES (?,?,?)",
        (title, content, tags))
    await db.commit()
    note_id = cur.lastrowid
    await db.close()
    # Push to Apple Notes in background for iCloud sync
    asyncio.create_task(_apple_notes_push(title or f"Note {note_id}", content))
    return {"ok": True, "id": note_id}

@app.put("/api/notes/{note_id}")
async def update_note(note_id: int, body: dict):
    db = await get_db()
    fields, vals = [], []
    for f in ("title", "content", "tags", "pinned"):
        if f in body:
            fields.append(f"{f}=?")
            vals.append(body[f])
    if not fields:
        raise HTTPException(status_code=400, detail="nothing to update")
    vals.extend([datetime.now().isoformat(), note_id])
    await db.execute(f"UPDATE notes SET {', '.join(fields)}, updated_at=? WHERE id=?", vals)
    await db.commit()
    # Get current title for Apple Notes sync
    row = await fetchone(db, "SELECT title, content FROM notes WHERE id=?", (note_id,))
    await db.close()
    if row and ("content" in body or "title" in body):
        asyncio.create_task(_apple_notes_push(row["title"] or f"Note {note_id}", row["content"] or ""))
    return {"ok": True}

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: int):
    db = await get_db()
    row = await fetchone(db, "SELECT title FROM notes WHERE id=?", (note_id,))
    await db.execute("DELETE FROM notes WHERE id=?", (note_id,))
    await db.commit()
    await db.close()
    if row and row["title"]:
        asyncio.create_task(_apple_notes_delete(row["title"]))
    return {"ok": True}

@app.post("/api/notes/import-apple")
async def import_apple_notes():
    """One-time import: pull all Apple Notes into SQLite (requires Notes permission)."""
    raw = await run_script([sys.executable, "-W", "ignore",
                            str(SCRIPTS_DIR / "apple_notes.py"), "list"])
    try:
        import json as _json
        data = _json.loads(raw)
        notes_list = data.get("notes", [])
    except Exception:
        return {"ok": False, "error": "Apple Notes not accessible — grant permission in System Settings → Privacy & Security → Automation", "raw": raw[:200]}

    db = await get_db()
    imported = 0
    for n in notes_list:
        name    = n.get("name", "")
        preview = n.get("preview", "")
        folder  = n.get("folder", "")
        if not name:
            continue
        exists = await fetchone(db, "SELECT id FROM notes WHERE title=?", (name,))
        if not exists:
            await db.execute(
                "INSERT INTO notes (title, content, tags) VALUES (?,?,?)",
                (name, preview, folder))
            imported += 1
    await db.commit()
    await db.close()
    return {"ok": True, "imported": imported, "total": len(notes_list)}

# ── API: Memory (Knowledge) ───────────────────────────────────────────────────

@app.get("/api/memories")
async def list_memories():
    """Return all memory entries with full metadata."""
    try:
        async with aiosqlite.connect(str(MEMORY_DB)) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT id, key, value, created_at, updated_at FROM memory WHERE user_id=0 ORDER BY updated_at DESC"
            )
            rows = await cur.fetchall()
        return {"memories": [dict(r) for r in rows]}
    except Exception as e:
        return {"memories": [], "error": str(e)}

@app.put("/api/memories/{key}")
async def update_memory(key: str, request: Request):
    """Update or create a memory entry by key."""
    data = await request.json()
    value = data.get("value", "").strip()
    if not value:
        raise HTTPException(400, "value required")
    await save_memory(key, value)
    return {"ok": True, "key": key}

@app.post("/api/memories")
async def create_memory(request: Request):
    """Create a new memory entry."""
    data = await request.json()
    key   = data.get("key", "").strip()
    value = data.get("value", "").strip()
    if not key or not value:
        raise HTTPException(400, "key and value required")
    await save_memory(key, value)
    return {"ok": True, "key": key}

@app.delete("/api/memories/{key}")
async def delete_memory(key: str):
    """Delete a memory entry by key."""
    try:
        async with aiosqlite.connect(str(MEMORY_DB)) as db:
            result = await db.execute(
                "DELETE FROM memory WHERE user_id=0 AND key=?", (key,))
            await db.commit()
            deleted = result.rowcount
        if deleted == 0:
            raise HTTPException(404, "Memory key not found")
        return {"ok": True, "key": key}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

# ── API: Documents (RAG) ──────────────────────────────────────────────────────

def _chunk_text(text: str, max_chars: int = 800) -> list[str]:
    """Split text into overlapping chunks by paragraph then sentence."""
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) < max_chars:
            current = (current + "\n\n" + para).strip()
        else:
            if current:
                chunks.append(current)
            # If single paragraph exceeds max, split by sentence
            if len(para) > max_chars:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                sent_chunk = ""
                for sent in sentences:
                    if len(sent_chunk) + len(sent) < max_chars:
                        sent_chunk = (sent_chunk + " " + sent).strip()
                    else:
                        if sent_chunk:
                            chunks.append(sent_chunk)
                        sent_chunk = sent
                if sent_chunk:
                    chunks.append(sent_chunk)
            else:
                current = para
    if current:
        chunks.append(current)
    return [c for c in chunks if len(c.strip()) > 20]


async def _extract_text(file_bytes: bytes, filename: str, mime_type: str) -> str:
    """Extract plain text from uploaded file."""
    if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                pages = [page.extract_text() or "" for page in pdf.pages]
            return "\n\n".join(p for p in pages if p.strip())
        except ImportError:
            return "[pdfplumber not installed — run: pip install pdfplumber]"
        except Exception as e:
            return f"[PDF extraction error: {e}]"
    else:
        # txt, md, csv, etc.
        try:
            return file_bytes.decode("utf-8", errors="replace")
        except Exception:
            return ""


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    """Upload a document, extract text, chunk, and index for RAG."""
    MAX_SIZE = 10 * 1024 * 1024  # 10MB
    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(400, f"File too large (max 10MB, got {len(file_bytes)//1024}KB)")

    # Supported types
    allowed_types = {
        "application/pdf", "text/plain", "text/markdown",
        "text/csv", "application/json", "text/x-markdown"
    }
    mime_type = file.content_type or "text/plain"
    fname = file.filename or "document.txt"
    ext = fname.lower().rsplit(".", 1)[-1] if "." in fname else ""
    if ext not in ("pdf", "txt", "md", "csv", "json") and mime_type not in allowed_types:
        raise HTTPException(400, f"Unsupported file type: {ext or mime_type}")

    # Dedup by content hash
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    db = await get_db()
    existing = await fetchone(db, "SELECT id, filename FROM documents WHERE file_hash=?", (file_hash,))
    if existing:
        await db.close()
        raise HTTPException(409, f"Document already uploaded as '{existing['filename']}' (id={existing['id']})")

    # Extract text
    text = await _extract_text(file_bytes, fname, mime_type)
    if not text.strip():
        await db.close()
        raise HTTPException(422, "No text could be extracted from this file (may be scanned image or empty)")

    # Create document record
    cur = await db.execute(
        "INSERT INTO documents (filename, file_hash, file_size, mime_type) VALUES (?,?,?,?)",
        (fname, file_hash, len(file_bytes), mime_type))
    doc_id = cur.lastrowid

    # Chunk and index
    chunks = _chunk_text(text)
    for i, chunk in enumerate(chunks):
        await db.execute(
            "INSERT INTO document_chunks (document_id, chunk_index, content) VALUES (?,?,?)",
            (doc_id, i, chunk))

    # Update chunk count
    await db.execute("UPDATE documents SET chunk_count=? WHERE id=?", (len(chunks), doc_id))
    await db.commit()

    # Rebuild FTS index
    try:
        await db.execute("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')")
        await db.commit()
    except Exception:
        pass

    await db.close()
    return {"ok": True, "id": doc_id, "filename": fname, "chunks": len(chunks), "size": len(file_bytes)}


@app.get("/api/documents")
async def list_documents():
    """List all uploaded documents."""
    db = await get_db()
    rows = await fetchall(db, "SELECT id, filename, file_size, mime_type, chunk_count, created_at FROM documents ORDER BY created_at DESC")
    await db.close()
    return {"documents": [dict(r) for r in rows]}


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: int):
    """Delete a document and all its chunks."""
    db = await get_db()
    existing = await fetchone(db, "SELECT id, filename FROM documents WHERE id=?", (doc_id,))
    if not existing:
        await db.close()
        raise HTTPException(404, "Document not found")
    await db.execute("DELETE FROM document_chunks WHERE document_id=?", (doc_id,))
    await db.execute("DELETE FROM documents WHERE id=?", (doc_id,))
    await db.commit()
    # Rebuild FTS
    try:
        await db.execute("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')")
        await db.commit()
    except Exception:
        pass
    await db.close()
    return {"ok": True, "id": doc_id, "filename": existing["filename"]}


@app.get("/api/documents/search")
async def search_documents(q: str, limit: int = 10):
    """FTS5 search over document chunks."""
    if not q or len(q.strip()) < 2:
        raise HTTPException(400, "query too short")
    chunks = await retrieve_relevant_chunks(q, limit=limit)
    return {"results": chunks, "query": q}

# ── API: Standing Orders ──────────────────────────────────────────────────────

@app.get("/api/standing-orders")
async def get_standing_orders():
    db = await get_db()
    rows = await fetchall(db, "SELECT * FROM standing_orders WHERE active=1 ORDER BY priority DESC, created_at DESC")
    await db.close()
    return {"orders": [dict(r) for r in rows]}

@app.post("/api/standing-orders")
async def create_standing_order(request: Request):
    data = await request.json()
    rule_text = data.get("rule_text", "").strip()
    if not rule_text:
        raise HTTPException(400, "rule_text required")
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO standing_orders (rule_text, trigger_type, auto_execute, priority) VALUES (?,?,?,?)",
        (rule_text, data.get("trigger_type", "message"),
         int(data.get("auto_execute", 0)), data.get("priority", "MED")))
    order_id = cursor.lastrowid
    await db.commit()
    row = await fetchone(db, "SELECT * FROM standing_orders WHERE id=?", (order_id,))
    await db.close()
    return JSONResponse({"order": dict(row)}, status_code=201)

@app.delete("/api/standing-orders/{order_id}")
async def delete_standing_order(order_id: int):
    db = await get_db()
    existing = await fetchone(db, "SELECT id FROM standing_orders WHERE id=?", (order_id,))
    if not existing:
        await db.close()
        raise HTTPException(404, "Standing order not found")
    await db.execute("UPDATE standing_orders SET active=0 WHERE id=?", (order_id,))
    await db.commit()
    await db.close()
    return {"ok": True, "id": order_id}

# ── API: Morning Brief ────────────────────────────────────────────────────────

@app.get("/api/morning-brief")
async def morning_brief():
    """Gather calendar, tasks, messages and compose a morning brief."""
    from datetime import date
    today = date.today()
    now_hour = datetime.now().hour
    greeting = (
        "Good morning" if now_hour < 12
        else "Good afternoon" if now_hour < 17
        else "Good evening"
    )

    # ── Calendar events today ──────────────────────────────────────────────
    calendar_events = []
    try:
        cal_raw = await asyncio.wait_for(
            run_script([sys.executable, "-W", "ignore",
                        str(SCRIPTS_DIR / "google_helper.py"), "calendar_today", "1"]),
            timeout=15)
        # Parse lines like: "09:00 - 10:00 | Meeting Title | Calendar"
        for line in cal_raw.strip().split("\n"):
            line = line.strip()
            if "|" in line and (":" in line[:10] or "All day" in line):
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 2:
                    calendar_events.append({
                        "time": parts[0],
                        "title": parts[1],
                        "calendar": parts[2] if len(parts) > 2 else ""
                    })
        if not calendar_events and cal_raw.strip():
            # Fallback: return raw lines
            for line in cal_raw.strip().split("\n"):
                if line.strip() and not line.startswith("No ") and not line.startswith("Error"):
                    calendar_events.append({"time": "", "title": line.strip(), "calendar": ""})
    except Exception as e:
        logger.warning(f"morning_brief calendar error: {e}")

    # ── Tasks ──────────────────────────────────────────────────────────────
    tasks_due = []
    try:
        tasks_raw = await asyncio.wait_for(
            run_script([sys.executable, "-W", "ignore",
                        str(SCRIPTS_DIR / "google_helper.py"), "tasks_list"]),
            timeout=15)
        current = None
        for line in tasks_raw.split("\n"):
            if line.startswith("⬜") or line.startswith("✅"):
                done = line.startswith("✅")
                if not done:  # only pending
                    text = line[2:].strip()
                    due = ""
                    due_m = re.search(r'\(due: ([^)]+)\)', text)
                    if due_m:
                        due = due_m.group(1)
                        text = text[:due_m.start()].strip()
                    current = {"title": text, "due": due}
                    tasks_due.append(current)
                else:
                    current = None
    except Exception as e:
        logger.warning(f"morning_brief tasks error: {e}")

    # ── Reminders ──────────────────────────────────────────────────────────
    reminders_today = []
    try:
        rem_raw = await asyncio.wait_for(
            run_script([str(SCRIPTS_DIR / "get_reminders.sh")]),
            timeout=10)
        for line in rem_raw.strip().split("\n"):
            line = line.strip()
            if line and not line.startswith("#") and len(line) > 2:
                reminders_today.append(line)
    except Exception as e:
        logger.warning(f"morning_brief reminders error: {e}")

    # ── Unread messages ────────────────────────────────────────────────────
    unread_count = 0
    high_priority_msgs = []
    try:
        db = await get_db()
        row = await fetchone(db, "SELECT COUNT(*) as c FROM messages WHERE read=0")
        unread_count = row["c"] if row else 0
        rows = await fetchall(db,
            "SELECT sender, subject, content FROM messages WHERE read=0 AND priority='HIGH' ORDER BY id DESC LIMIT 5")
        high_priority_msgs = [dict(r) for r in rows]
        await db.close()
    except Exception as e:
        logger.warning(f"morning_brief messages error: {e}")

    # ── Personal memory facts ──────────────────────────────────────────────
    memories = await get_memories()
    user_name = next((m["value"] for m in memories if m["key"] == "user_name"), "Christian")
    first_name = user_name.split()[0] if user_name else "Christian"

    # ── AI Summary ────────────────────────────────────────────────────────
    ai_summary = ""
    try:
        brief_data_text = f"""Today is {today.strftime('%A, %B %d, %Y')}.

Calendar events today ({len(calendar_events)}):
{chr(10).join(f"- {e['time']} {e['title']}" for e in calendar_events[:8]) if calendar_events else '- No events scheduled'}

Pending tasks ({len(tasks_due)}):
{chr(10).join(f"- {t['title']}" + (f" (due {t['due']})" if t['due'] else '') for t in tasks_due[:5]) if tasks_due else '- No pending tasks'}

Unread messages: {unread_count}
{('High priority: ' + ', '.join(m['subject'] or m['sender'] for m in high_priority_msgs[:3])) if high_priority_msgs else ''}"""

        brief_prompt = f"""<system>
You are AntiGravity, {first_name}'s executive AI assistant. Write a concise, upbeat morning brief.
Format: 2-3 sentences max. Mention the most important things for today. Be specific.
Do not use markdown headers or bullet points — write in flowing prose.
End with one brief actionable suggestion or encouragement.
</system>
Write a morning brief for {first_name} based on:
{brief_data_text}"""

        env = os.environ.copy()
        for key in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
            env.pop(key, None)

        proc = await asyncio.create_subprocess_exec(
            CLAUDE_CLI, "-p", brief_prompt,
            "--model", CLAUDE_MODEL,
            "--output-format", "text",
            "--no-session-persistence",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=env,
            cwd=str(BASE_DIR)
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        ai_summary = stdout.decode("utf-8", errors="replace").strip()
    except Exception as e:
        logger.warning(f"morning_brief AI summary error: {e}")
        # Fallback summary
        parts = []
        if calendar_events:
            parts.append(f"You have {len(calendar_events)} event{'s' if len(calendar_events)!=1 else ''} today")
        if tasks_due:
            parts.append(f"{len(tasks_due)} pending task{'s' if len(tasks_due)!=1 else ''}")
        if unread_count:
            parts.append(f"{unread_count} unread message{'s' if unread_count!=1 else ''}")
        ai_summary = f"{greeting}, {first_name}! " + (", ".join(parts) + "." if parts else "Have a great day!")

    return {
        "greeting": f"{greeting}, {first_name}",
        "date": today.strftime("%A, %B %d, %Y"),
        "ai_summary": ai_summary,
        "calendar": calendar_events[:8],
        "tasks": tasks_due[:8],
        "reminders": reminders_today[:5],
        "unread_messages": unread_count,
        "high_priority_messages": high_priority_msgs,
        "generated_at": datetime.now().isoformat()
    }


@app.get("/api/daily-digest")
async def daily_digest(scope: str = "today"):
    """Return a structured daily digest object for dashboard persistence."""
    brief = await morning_brief()
    calendar_events = brief.get("calendar", [])
    task_items = brief.get("tasks", [])
    important_emails = brief.get("high_priority_messages", [])
    reminders = brief.get("reminders", [])
    digest_date = datetime.now().date().isoformat()

    return {
        "generatedAt": brief.get("generated_at"),
        "digestDate": digest_date,
        "scope": scope,
        "summary": brief.get("ai_summary", ""),
        "calendar": {
            "events": [
                {
                    "title": ev.get("title", ""),
                    "start": ev.get("time", ""),
                    "end": "",
                    "people": [],
                    "sourceLink": None,
                    "notesLink": None,
                    "urgency": "normal"
                } for ev in calendar_events
            ]
        },
        "prep": {
            "items": [
                {
                    "title": f"Prep for: {ev.get('title','')}",
                    "why": "Meeting appears on the calendar digest",
                    "dueBy": ev.get("time", ""),
                    "sourceLink": None,
                    "relatedEvent": ev.get("title", ""),
                    "urgency": "normal"
                } for ev in calendar_events[:3]
            ]
        },
        "emails": {
            "important": [
                {
                    "sender": msg.get("sender", ""),
                    "subject": msg.get("subject", ""),
                    "summary": (msg.get("content", "") or "")[:180],
                    "link": None,
                    "urgency": "high",
                    "source": "gmail"
                } for msg in important_emails
            ]
        },
        "tasks": {
            "top": [
                {
                    "title": t.get("title", ""),
                    "source": "google_tasks",
                    "due": t.get("due", ""),
                    "link": None,
                    "urgency": "normal"
                } for t in task_items
            ],
            "reminders": reminders[:5]
        },
        "followUps": {
            "pending": []
        },
        "attention": {
            "alerts": [
                {
                    "title": "High priority unread messages",
                    "body": f"{len(important_emails)} message(s) need attention",
                    "kind": "email",
                    "urgency": "high",
                    "link": None
                }
            ] if important_emails else []
        }
    }


# ── API: Email Management ─────────────────────────────────────────────────────

def _parse_gmail_list_output(output: str) -> list[dict]:
    """Parse gmail_unread / gmail_search text output into structured JSON."""
    emails = []
    if not output or "No " in output[:30]:
        return emails
    blocks = re.split(r"\n(?=[📩📧])", output)
    for block in blocks:
        lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
        if not lines:
            continue
        email = {"id": "", "from": "", "subject": "", "snippet": "", "date": "", "labels": []}
        first = lines[0]
        if first.startswith("\U0001f4e9"):
            email["date"] = first[2:].strip()
            email["labels"].append("UNREAD")
        elif first.startswith("\U0001f4e7"):
            email["date"] = first[2:].strip()
        for line in lines[1:]:
            if line.startswith("From:"):
                email["from"] = line[5:].strip()
            elif line.startswith("Subject:"):
                email["subject"] = line[8:].strip()
            elif line.startswith("[ID:") and line.endswith("]"):
                email["id"] = line[4:-1].strip()
            else:
                if not email["snippet"]:
                    email["snippet"] = line.strip()
        # Handle search format: "📧 date | From: x | Subject"
        if "|" in first and not email["from"]:
            parts = first.split("|")
            for p in parts:
                p = p.strip()
                if p.startswith("From:"):
                    email["from"] = p[5:].strip()
                elif p.startswith("\U0001f4e9") or p.startswith("\U0001f4e7"):
                    email["date"] = p[2:].strip()
                elif not email["subject"]:
                    email["subject"] = p
        if email["id"] or email["from"] or email["subject"]:
            emails.append(email)
    return emails


@app.get("/api/email")
async def list_emails(limit: int = 20, search: str = None, unread_only: bool = False):
    """List emails with optional search and unread filter."""
    try:
        if search:
            cmd = [sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
                   "gmail_search", search, str(limit)]
        elif unread_only:
            cmd = [sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
                   "gmail_unread", str(limit)]
        else:
            cmd = [sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
                   "gmail_unread", str(limit)]
        output = await run_script(cmd, timeout=20)
        emails = _parse_gmail_list_output(output)
        return {"emails": emails, "count": len(emails), "raw": output}
    except Exception as e:
        logger.warning(f"list_emails error: {e}")
        return {"emails": [], "count": 0, "error": str(e)}


@app.get("/api/email/labels")
async def get_email_labels():
    """List Gmail labels."""
    try:
        output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"), "gmail_labels"
        ], timeout=15)
        labels = []
        for line in output.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Parse: "🏷️ LabelName  [ID: xxx]  (type)"
            id_match = re.search(r'\[ID:\s*([^\]]+)\]', line)
            type_match = re.search(r'\((\w+)\)\s*$', line)
            name = re.sub(r'\s*\[ID:.*', '', line).replace("\U0001f3f7\ufe0f", "").strip()
            labels.append({
                "name": name,
                "id": id_match.group(1).strip() if id_match else "",
                "type": type_match.group(1) if type_match else "user"
            })
        return {"labels": labels}
    except Exception as e:
        logger.warning(f"get_email_labels error: {e}")
        return {"labels": [], "error": str(e)}


@app.get("/api/email/{msg_id}")
async def read_email(msg_id: str):
    """Read full email content by message ID."""
    try:
        output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
            "gmail_read", msg_id
        ], timeout=15)
        # Parse the output
        email = {"id": msg_id, "from": "", "to": "", "date": "", "subject": "", "body": ""}
        lines = output.split("\n")
        body_start = False
        body_lines = []
        for line in lines:
            if body_start:
                body_lines.append(line)
            elif line.startswith("From:"):
                email["from"] = line[5:].strip()
            elif line.startswith("To:"):
                email["to"] = line[3:].strip()
            elif line.startswith("Date:"):
                email["date"] = line[5:].strip()
            elif line.startswith("Subject:"):
                email["subject"] = line[8:].strip()
            elif line.strip() == "" and email["subject"]:
                body_start = True
        email["body"] = "\n".join(body_lines).strip()
        return email
    except Exception as e:
        logger.warning(f"read_email error: {e}")
        return {"error": str(e)}


@app.post("/api/email/send")
async def send_email(request: Request):
    """Send an email. Body: {to, subject, body, cc?, bcc?}"""
    data = await request.json()
    to = data.get("to", "")
    subject = data.get("subject", "")
    body = data.get("body", "")
    if not to or not subject or not body:
        raise HTTPException(400, "to, subject, and body required")
    try:
        output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
            "gmail_send", to, subject, body
        ], timeout=20)
        return {"ok": True, "result": output}
    except Exception as e:
        logger.warning(f"send_email error: {e}")
        return {"ok": False, "error": str(e)}


@app.post("/api/email/reply")
async def reply_email(request: Request):
    """Reply to an email. Body: {message_id, body, to, subject}"""
    data = await request.json()
    msg_id = data.get("message_id", "")
    body = data.get("body", "")
    to = data.get("to", "")
    subject = data.get("subject", "")
    if not body or not to:
        raise HTTPException(400, "body and to required")
    if not subject:
        subject = "Re: (no subject)"
    try:
        output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
            "gmail_send", to, subject, body
        ], timeout=20)
        return {"ok": True, "result": output, "in_reply_to": msg_id}
    except Exception as e:
        logger.warning(f"reply_email error: {e}")
        return {"ok": False, "error": str(e)}


@app.post("/api/email/{msg_id}/archive")
async def archive_email(msg_id: str):
    """Archive an email (remove from inbox)."""
    try:
        output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
            "gmail_archive", msg_id
        ], timeout=15)
        return {"ok": True, "result": output}
    except Exception as e:
        logger.warning(f"archive_email error: {e}")
        return {"ok": False, "error": str(e)}


@app.post("/api/email/{msg_id}/trash")
async def trash_email(msg_id: str):
    """Move an email to trash."""
    try:
        output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
            "gmail_trash", msg_id
        ], timeout=15)
        return {"ok": True, "result": output}
    except Exception as e:
        logger.warning(f"trash_email error: {e}")
        return {"ok": False, "error": str(e)}


@app.post("/api/email/draft")
async def draft_email(request: Request):
    """Generate a draft email using Claude. Body: {context, tone?, length?}"""
    data = await request.json()
    context = data.get("context", "")
    tone = data.get("tone", "professional")
    length = data.get("length", "medium")
    if not context:
        raise HTTPException(400, "context required")
    try:
        prompt = (
            f"Draft an email based on this context. Tone: {tone}. Length: {length}.\n"
            f"Return ONLY the email text (subject line on first line prefixed with 'Subject: ', "
            f"then blank line, then body). No explanations.\n\nContext: {context}"
        )
        env = os.environ.copy()
        for key in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
            env.pop(key, None)
        proc = await asyncio.create_subprocess_exec(
            CLAUDE_CLI, "-p", prompt,
            "--model", CLAUDE_MODEL,
            "--output-format", "text",
            "--no-session-persistence",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        draft = stdout.decode("utf-8", errors="replace").strip()
        # Parse subject from draft
        subject = ""
        body = draft
        if draft.startswith("Subject:"):
            lines = draft.split("\n", 1)
            subject = lines[0].replace("Subject:", "").strip()
            body = lines[1].strip() if len(lines) > 1 else ""
        return {"ok": True, "draft": draft, "subject": subject, "body": body}
    except Exception as e:
        logger.warning(f"draft_email error: {e}")
        return {"ok": False, "error": str(e)}


# ── API: Task Management (extended) ──────────────────────────────────────────

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, tasklist: str = "@default"):
    """Delete a Google Task."""
    try:
        output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
            "tasks_delete", task_id, tasklist
        ])
        return {"ok": True, "result": output}
    except Exception as e:
        logger.warning(f"delete_task error: {e}")
        return {"ok": False, "error": str(e)}


@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, request: Request):
    """Update a Google Task. Body: {title?, due_date?, notes?, tasklist?}"""
    data = await request.json()
    title = data.get("title", "")
    due_date = data.get("due_date", "")
    notes = data.get("notes", "")
    tasklist = data.get("tasklist", "@default")
    try:
        cmd = [sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
               "tasks_update", task_id, title, due_date, notes, tasklist]
        output = await run_script(cmd)
        return {"ok": True, "result": output}
    except Exception as e:
        logger.warning(f"update_task error: {e}")
        return {"ok": False, "error": str(e)}


@app.get("/api/tasks/lists")
async def get_task_lists():
    """List all Google Task lists."""
    try:
        output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"), "tasks_lists"
        ])
        lists = []
        for line in output.split("\n"):
            line = line.strip()
            if not line:
                continue
            id_match = re.search(r'\[ID:\s*([^\]]+)\]', line)
            name = re.sub(r'\s*\[ID:.*', '', line).replace("\U0001f4cb", "").strip()
            lists.append({
                "name": name,
                "id": id_match.group(1).strip() if id_match else ""
            })
        return {"lists": lists}
    except Exception as e:
        logger.warning(f"get_task_lists error: {e}")
        return {"lists": [], "error": str(e)}


# ── API: Structured Reminders ────────────────────────────────────────────────

@app.get("/api/reminders/structured")
async def get_structured_reminders():
    """Parse Apple Reminders into structured JSON."""
    try:
        output = await run_script([str(SCRIPTS_DIR / "get_reminders.sh")], timeout=15)
        reminders = []
        current_list = ""
        for line in output.split("\n"):
            line = line.strip()
            if not line:
                continue
            if line.startswith("\U0001f4cb") and line.endswith(":"):
                current_list = line[2:].rstrip(":").strip()
                continue
            completed = line.startswith("\u2705")
            pending = line.startswith("\u2b1c")
            if completed or pending:
                text = line[2:].strip()
                due = ""
                due_match = re.search(r'\(due:\s*([^)]+)\)', text)
                if due_match:
                    due = due_match.group(1).strip()
                    text = text[:due_match.start()].strip()
                priority = "normal"
                if "\u203c\ufe0f" in line:
                    priority = "high"
                    text = text.replace("\u203c\ufe0f", "").strip()
                elif "\u2757" in line:
                    priority = "medium"
                    text = text.replace("\u2757", "").strip()
                reminder_id = f"{current_list}::{text}"
                reminders.append({
                    "id": reminder_id,
                    "title": text,
                    "due": due,
                    "list": current_list,
                    "completed": completed,
                    "priority": priority
                })
        return {"reminders": reminders, "count": len(reminders)}
    except Exception as e:
        logger.warning(f"get_structured_reminders error: {e}")
        return {"reminders": [], "error": str(e)}


@app.post("/api/reminders/{reminder_id}/complete")
async def complete_reminder(reminder_id: str):
    """Complete a reminder via AppleScript. reminder_id format: 'ListName::Title'"""
    try:
        import urllib.parse
        decoded = urllib.parse.unquote(reminder_id)
        parts = decoded.split("::", 1)
        list_name = parts[0] if len(parts) > 1 else "Reminders"
        title = parts[1] if len(parts) > 1 else parts[0]
        # Escape quotes for AppleScript
        title_escaped = title.replace('"', '\\"')
        list_escaped = list_name.replace('"', '\\"')
        script = (
            f'tell application "Reminders"\n'
            f'  set theReminders to every reminder of list "{list_escaped}" whose name is "{title_escaped}"\n'
            f'  repeat with r in theReminders\n'
            f'    set completed of r to true\n'
            f'  end repeat\n'
            f'  return "Completed: {title_escaped}"\n'
            f'end tell'
        )
        output = await run_script(["osascript", "-e", script], timeout=10)
        return {"ok": True, "result": output}
    except Exception as e:
        logger.warning(f"complete_reminder error: {e}")
        return {"ok": False, "error": str(e)}


@app.delete("/api/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str):
    """Delete a reminder via AppleScript. reminder_id format: 'ListName::Title'"""
    try:
        import urllib.parse
        decoded = urllib.parse.unquote(reminder_id)
        parts = decoded.split("::", 1)
        list_name = parts[0] if len(parts) > 1 else "Reminders"
        title = parts[1] if len(parts) > 1 else parts[0]
        title_escaped = title.replace('"', '\\"')
        list_escaped = list_name.replace('"', '\\"')
        script = (
            f'tell application "Reminders"\n'
            f'  set theReminders to every reminder of list "{list_escaped}" whose name is "{title_escaped}"\n'
            f'  repeat with r in theReminders\n'
            f'    delete r\n'
            f'  end repeat\n'
            f'  return "Deleted: {title_escaped}"\n'
            f'end tell'
        )
        output = await run_script(["osascript", "-e", script], timeout=10)
        return {"ok": True, "result": output}
    except Exception as e:
        logger.warning(f"delete_reminder error: {e}")
        return {"ok": False, "error": str(e)}


# ── API: Web Search ──────────────────────────────────────────────────────────

@app.post("/api/search/web")
async def web_search(request: Request):
    """Search the web via DuckDuckGo HTML. Body: {query, limit?}"""
    data = await request.json()
    query = data.get("query", "").strip()
    limit = data.get("limit", 5)
    if not query:
        raise HTTPException(400, "query required")
    try:
        import urllib.parse
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        cmd = ["curl", "-s", "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", "--max-time", "10", url]
        html = await run_script(cmd, timeout=15)
        # Parse results from DuckDuckGo HTML
        results = []
        # Extract result blocks: <a class="result__a" href="...">Title</a>
        # and <a class="result__snippet">Snippet</a>
        title_pattern = re.compile(r'<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', re.DOTALL)
        snippet_pattern = re.compile(r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>', re.DOTALL)
        titles = title_pattern.findall(html)
        snippets = snippet_pattern.findall(html)
        for i, (href, title_html) in enumerate(titles[:limit]):
            # Clean HTML tags from title and snippet
            title = re.sub(r'<[^>]+>', '', title_html).strip()
            snippet = ""
            if i < len(snippets):
                snippet = re.sub(r'<[^>]+>', '', snippets[i]).strip()
            # DuckDuckGo wraps URLs in a redirect; extract actual URL
            actual_url = href
            if "uddg=" in href:
                url_match = re.search(r'uddg=([^&]+)', href)
                if url_match:
                    actual_url = urllib.parse.unquote(url_match.group(1))
            if title:
                results.append({"title": title, "url": actual_url, "snippet": snippet})
        return {"results": results, "query": query, "count": len(results)}
    except Exception as e:
        logger.warning(f"web_search error: {e}")
        return {"results": [], "query": query, "error": str(e)}


# ── API: Contact Intelligence ────────────────────────────────────────────────

@app.get("/api/contacts/intelligence")
async def contact_intelligence(name: str):
    """Return recent context about a person: emails, messages, events."""
    if not name or len(name.strip()) < 2:
        raise HTTPException(400, "name required (min 2 chars)")
    name = name.strip()
    result = {
        "name": name,
        "recent_emails": [],
        "recent_messages": [],
        "upcoming_events": [],
        "last_contact": None
    }

    # 1. Search Gmail for emails from/to that person
    try:
        email_output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
            "gmail_search", f"from:{name} OR to:{name}", "5"
        ], timeout=15)
        result["recent_emails"] = _parse_gmail_list_output(email_output)
    except Exception as e:
        logger.warning(f"contact_intelligence gmail error: {e}")

    # 2. Search iMessage history
    try:
        imsg_output = await run_script([
            str(SCRIPTS_DIR / "get_recent_imessages.sh"), "50", name
        ], timeout=10)
        messages = []
        if imsg_output:
            for line in imsg_output.split("\n"):
                parts = line.strip().split("|", 2)
                if len(parts) >= 3:
                    messages.append({
                        "timestamp": parts[0].strip(),
                        "sender": parts[1].strip(),
                        "text": parts[2].strip()
                    })
        result["recent_messages"] = messages[:10]
    except Exception as e:
        logger.warning(f"contact_intelligence imessage error: {e}")

    # 3. Check calendar for events with that person
    try:
        cal_output = await run_script([
            sys.executable, "-W", "ignore", str(SCRIPTS_DIR / "google_helper.py"),
            "calendar_today", "7"
        ], timeout=15)
        events = []
        current_date = ""
        name_lower = name.lower()
        for line in cal_output.split("\n"):
            line = line.strip()
            if line.startswith("\U0001f4c5"):
                current_date = line[2:].strip()
            elif "|" in line and name_lower in line.lower():
                parts = line.split("|", 1)
                events.append({
                    "date": current_date,
                    "time": parts[0].strip(),
                    "title": parts[1].strip() if len(parts) > 1 else ""
                })
        result["upcoming_events"] = events
    except Exception as e:
        logger.warning(f"contact_intelligence calendar error: {e}")

    # Determine last contact date
    timestamps = []
    for e in result["recent_emails"]:
        if e.get("date"):
            timestamps.append(e["date"])
    for m in result["recent_messages"]:
        if m.get("timestamp"):
            timestamps.append(m["timestamp"])
    if timestamps:
        result["last_contact"] = timestamps[0]

    return result


# ── API: Conversation Search ─────────────────────────────────────────────────

@app.get("/api/conversations/search")
async def search_conversations(q: str, limit: int = 20):
    """Search the conversations table with LIKE on content+role."""
    if not q or len(q.strip()) < 2:
        raise HTTPException(400, "query too short")
    try:
        db = await get_db()
        rows = await fetchall(db,
            "SELECT * FROM conversations WHERE content LIKE ? ORDER BY timestamp DESC LIMIT ?",
            (f"%{q}%", limit))
        await db.close()
        return {"messages": [dict(r) for r in rows], "count": len(rows), "query": q}
    except Exception as e:
        logger.warning(f"search_conversations error: {e}")
        return {"messages": [], "error": str(e)}


# ── API: File Upload to Chat ─────────────────────────────────────────────────

@app.post("/api/chat/upload")
async def chat_upload(file: UploadFile = File(...)):
    """Upload a file or image for chat context injection / screenshot review."""
    try:
        MAX_SIZE = 10 * 1024 * 1024  # 10MB
        file_bytes = await file.read()
        if len(file_bytes) > MAX_SIZE:
            raise HTTPException(400, f"File too large (max 10MB, got {len(file_bytes)//1024}KB)")
        fname = file.filename or "upload.txt"
        mime_type = file.content_type or "text/plain"
        ext = fname.lower().rsplit('.', 1)[-1] if '.' in fname else ''

        image_exts = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
        image_mimes = {'image/png', 'image/jpeg', 'image/webp', 'image/gif'}
        is_image = ext in image_exts or mime_type in image_mimes

        if is_image:
            uploads_dir = STATIC_DIR / 'uploads'
            uploads_dir.mkdir(parents=True, exist_ok=True)
            safe_name = re.sub(r'[^A-Za-z0-9._-]+', '-', fname)
            file_hash = hashlib.sha256(file_bytes).hexdigest()[:12]
            stored_name = f"{file_hash}-{safe_name}"
            out_path = uploads_dir / stored_name
            out_path.write_bytes(file_bytes)
            return {
                "ok": True,
                "filename": fname,
                "mime_type": mime_type,
                "is_image": True,
                "image_url": f"/static/uploads/{stored_name}",
                "text": f"[Image attached: {fname}]\nUse this screenshot/image as UI or visual context.",
                "text_length": 0,
                "indexed": False,
                "doc_id": None,
                "chunks": 0
            }

        text = await _extract_text(file_bytes, fname, mime_type)
        if not text.strip():
            return {"ok": False, "error": "No text could be extracted from this file"}

        # Optionally add to RAG if substantial
        doc_id = None
        chunk_count = 0
        if len(text.strip()) > 100:
            try:
                file_hash = hashlib.sha256(file_bytes).hexdigest()
                db = await get_db()
                existing = await fetchone(db, "SELECT id FROM documents WHERE file_hash=?", (file_hash,))
                if not existing:
                    cur = await db.execute(
                        "INSERT INTO documents (filename, file_hash, file_size, mime_type) VALUES (?,?,?,?)",
                        (fname, file_hash, len(file_bytes), mime_type))
                    doc_id = cur.lastrowid
                    chunks = _chunk_text(text)
                    for i, chunk in enumerate(chunks):
                        await db.execute(
                            "INSERT INTO document_chunks (document_id, chunk_index, content) VALUES (?,?,?)",
                            (doc_id, i, chunk))
                    await db.execute("UPDATE documents SET chunk_count=? WHERE id=?", (len(chunks), doc_id))
                    await db.commit()
                    chunk_count = len(chunks)
                    try:
                        await db.execute("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')")
                        await db.commit()
                    except Exception:
                        pass
                await db.close()
            except Exception as e:
                logger.warning(f"chat_upload RAG indexing error: {e}")

        return {
            "ok": True,
            "filename": fname,
            "mime_type": mime_type,
            "is_image": False,
            "text": text[:10000],  # Limit returned text
            "text_length": len(text),
            "indexed": doc_id is not None,
            "doc_id": doc_id,
            "chunks": chunk_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"chat_upload error: {e}")
        return {"ok": False, "error": str(e)}


# ── API: Delegation Tracker ──────────────────────────────────────────────────

@app.get("/api/delegations")
async def list_delegations(status: str = None):
    """List all delegations, optionally filtered by status."""
    try:
        db = await get_db()
        if status:
            rows = await fetchall(db,
                "SELECT * FROM delegations WHERE status=? ORDER BY created_at DESC", (status,))
        else:
            rows = await fetchall(db,
                "SELECT * FROM delegations ORDER BY created_at DESC")
        await db.close()
        return {"delegations": [dict(r) for r in rows], "count": len(rows)}
    except Exception as e:
        logger.warning(f"list_delegations error: {e}")
        return {"delegations": [], "error": str(e)}


@app.post("/api/delegations")
async def create_delegation(request: Request):
    """Create a delegation. Body: {person, task, due_date?, notes?}"""
    data = await request.json()
    person = data.get("person", "").strip()
    task = data.get("task", "").strip()
    if not person or not task:
        raise HTTPException(400, "person and task required")
    due_date = data.get("due_date", "")
    notes = data.get("notes", "")
    try:
        db = await get_db()
        cur = await db.execute(
            "INSERT INTO delegations (person, task, due_date, notes) VALUES (?,?,?,?)",
            (person, task, due_date or None, notes))
        delegation_id = cur.lastrowid
        await db.commit()
        await db.close()
        return {"ok": True, "id": delegation_id}
    except Exception as e:
        logger.warning(f"create_delegation error: {e}")
        return {"ok": False, "error": str(e)}


@app.put("/api/delegations/{delegation_id}")
async def update_delegation(delegation_id: int, request: Request):
    """Update a delegation. Body: {status?, notes?, due_date?}"""
    data = await request.json()
    try:
        db = await get_db()
        existing = await fetchone(db, "SELECT id FROM delegations WHERE id=?", (delegation_id,))
        if not existing:
            await db.close()
            raise HTTPException(404, "Delegation not found")
        sets, params = [], []
        for field in ("status", "notes", "due_date", "person", "task"):
            if field in data:
                sets.append(f"{field} = ?")
                params.append(data[field])
        if not sets:
            await db.close()
            raise HTTPException(400, "nothing to update")
        params.append(delegation_id)
        await db.execute(f"UPDATE delegations SET {', '.join(sets)} WHERE id=?", params)
        await db.commit()
        await db.close()
        return {"ok": True, "id": delegation_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"update_delegation error: {e}")
        return {"ok": False, "error": str(e)}


@app.delete("/api/delegations/{delegation_id}")
async def delete_delegation(delegation_id: int):
    """Delete a delegation."""
    try:
        db = await get_db()
        existing = await fetchone(db, "SELECT id FROM delegations WHERE id=?", (delegation_id,))
        if not existing:
            await db.close()
            raise HTTPException(404, "Delegation not found")
        await db.execute("DELETE FROM delegations WHERE id=?", (delegation_id,))
        await db.commit()
        await db.close()
        return {"ok": True, "id": delegation_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"delete_delegation error: {e}")
        return {"ok": False, "error": str(e)}


@app.get("/api/agents/roster")
async def get_agent_roster(refresh: bool = False):
    """Return the joined agent roster used by the dashboard/chief-of-staff."""
    if refresh:
        output = await run_script(["node", str(SCRIPTS_DIR / "reconcile-openclaw-agent-sessions.mjs")], timeout=30)
        if output.startswith("Error:"):
            raise HTTPException(status_code=500, detail=output)
    payload = load_agent_roster_payload()
    if payload is None:
        raise HTTPException(status_code=404, detail="Agent roster not generated yet")
    return payload


# ── Catch-all: serve PWA for all routes ──────────────────────────────────────

@app.get("/health")
async def health_dashboard():
    health_file = STATIC_DIR / "health.html"
    if health_file.exists():
        return FileResponse(str(health_file))
    # Fallback: redirect to API
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/heartbeat")

@app.get("/{full_path:path}")
async def catch_all(full_path: str):
    # Serve actual static files if they exist, otherwise serve the SPA
    static_file = STATIC_DIR / full_path
    if static_file.exists() and static_file.is_file():
        return FileResponse(static_file)
    return FileResponse(STATIC_DIR / "index.html", media_type="text/html")

# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8420, log_level="info")
