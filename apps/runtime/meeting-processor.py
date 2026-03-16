#!/usr/bin/env python3
"""
OpenClaw Meeting Processor — Full Fireflies meeting intake pipeline.

Takes a Fireflies meeting ID, pulls full data from the Fireflies GraphQL API,
and produces:
  1. Meeting document in .antigravity/details/meetings/
  2. Task files for action items in .antigravity/tasks/items/
  3. Commitment records appended to boswell-commitments.jsonl
  4. Calendar event creation commands for deadlines (via gws calendar)
  5. Related email correlation from Gmail participants
  6. Summary output of everything created

Usage:
    python3 meeting-processor.py <fireflies_meeting_id>
    python3 meeting-processor.py <fireflies_meeting_id> --dry-run
    python3 meeting-processor.py <fireflies_meeting_id> --skip-calendar
"""

import os
import sys
import json
import re
import subprocess
import hashlib
import logging
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path
from textwrap import dedent
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = Path("/Volumes/Storage/OpenClaw")
SECRETS_DIR = BASE_DIR / ".secrets"
MEETINGS_DIR = BASE_DIR / ".antigravity" / "details" / "meetings"
TASKS_DIR = BASE_DIR / ".antigravity" / "tasks" / "items"
COMMITMENTS_FILE = BASE_DIR / ".antigravity" / "details" / "boswell-commitments.jsonl"
DISPATCHES_DIR = BASE_DIR / ".antigravity" / "runtime" / "dispatches"
LOG_FILE = BASE_DIR / ".antigravity" / "runtime" / "meeting-processing.log"
API_KEY_FILE = SECRETS_DIR / "fireflies_api_key.txt"

FIREFLIES_API_URL = "https://api.fireflies.ai/graphql"

# Christian's identifiers for action-item matching
CHRISTIAN_IDENTIFIERS = [
    "christian", "cd", "christian de ramos", "cderamos",
    "christian@visualgraphx.com", "christian@2ct.media", "cderamos@gmail.com",
]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("meeting-processor")

# Add file handler after ensuring parent directory exists
def _setup_file_logging():
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    fh = logging.FileHandler(str(LOG_FILE), mode="a")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    log.addHandler(fh)

_setup_file_logging()


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def get_api_key() -> str:
    """Read Fireflies API key from secrets file."""
    env_key = os.environ.get("FIREFLIES_API_KEY")
    if env_key:
        return env_key.strip()
    if API_KEY_FILE.exists():
        return API_KEY_FILE.read_text().strip()
    raise RuntimeError(
        f"Fireflies API key not found. Set FIREFLIES_API_KEY env var "
        f"or place key in {API_KEY_FILE}"
    )


def meeting_doc_path(meeting_id: str, title: str, date_str: str) -> Path:
    """Generate a filesystem-safe meeting doc path."""
    safe_title = re.sub(r"[^a-zA-Z0-9_\- ]", "", title or "untitled")
    safe_title = re.sub(r"\s+", "-", safe_title.strip())[:60]
    date_prefix = date_str[:10] if date_str else "undated"
    filename = f"{date_prefix}_{safe_title}_{meeting_id[:8]}.md"
    return MEETINGS_DIR / filename


def is_meeting_processed(meeting_id: str) -> bool:
    """Check if a meeting document already exists for this ID (idempotency)."""
    if not MEETINGS_DIR.exists():
        return False
    for f in MEETINGS_DIR.iterdir():
        if meeting_id[:8] in f.name or meeting_id in f.read_text(errors="ignore")[:500]:
            return True
    return False


# ---------------------------------------------------------------------------
# Fireflies GraphQL API
# ---------------------------------------------------------------------------

def fireflies_graphql(query: str, variables: dict = None) -> dict:
    """Execute a GraphQL query against the Fireflies API."""
    api_key = get_api_key()
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    cmd = [
        "curl", "-s", "-X", "POST",
        FIREFLIES_API_URL,
        "-H", f"Authorization: Bearer {api_key}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(payload),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise RuntimeError(f"curl failed: {result.stderr}")
        data = json.loads(result.stdout)
        if "errors" in data:
            raise RuntimeError(f"GraphQL errors: {json.dumps(data['errors'])}")
        return data.get("data", {})
    except subprocess.TimeoutExpired:
        raise RuntimeError("Fireflies API request timed out after 30s")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON from Fireflies API: {e}")


def fetch_meeting_full(meeting_id: str) -> dict:
    """Fetch full meeting data: transcript, summary, action items, participants."""
    query = """
    query($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        organizer_email
        participants
        transcript_url
        sentences {
          speaker_name
          text
          start_time
          end_time
        }
        summary {
          overview
          action_items
          keywords
          outline
          shorthand_bullet
        }
      }
    }
    """
    data = fireflies_graphql(query, {"id": meeting_id})
    transcript = data.get("transcript")
    if not transcript:
        raise RuntimeError(f"No transcript found for meeting ID: {meeting_id}")
    return transcript


# ---------------------------------------------------------------------------
# Meeting Document Generation
# ---------------------------------------------------------------------------

def format_duration(minutes: float) -> str:
    if not minutes:
        return "unknown"
    h = int(minutes) // 60
    m = int(minutes) % 60
    if h > 0:
        return f"{h}h {m}m"
    return f"{m}m"


def format_timestamp(seconds: float) -> str:
    if not seconds:
        return "0:00"
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}:{s:02d}"


def generate_meeting_document(meeting: dict) -> str:
    """Generate a full meeting document in markdown."""
    meeting_id = meeting["id"]
    title = meeting.get("title", "Untitled Meeting")
    date_raw = meeting.get("date")
    date_str = datetime.fromtimestamp(date_raw / 1000, tz=timezone.utc).isoformat() if date_raw else "unknown"
    duration = meeting.get("duration")
    organizer = meeting.get("organizer_email", "unknown")
    participants = meeting.get("participants") or []
    transcript_url = meeting.get("transcript_url", "")
    summary_data = meeting.get("summary") or {}

    overview = summary_data.get("overview", "No overview available.")
    action_items = summary_data.get("action_items") or []
    keywords = summary_data.get("keywords") or []
    outline = summary_data.get("outline") or []
    bullets = summary_data.get("shorthand_bullet") or []
    sentences = meeting.get("sentences") or []

    # Build the document
    lines = []
    lines.append("---")
    lines.append(f'fireflies_id: "{meeting_id}"')
    lines.append(f'title: "{title}"')
    lines.append(f'date: "{date_str}"')
    lines.append(f'duration: "{format_duration(duration)}"')
    lines.append(f'organizer: "{organizer}"')
    lines.append(f'participants:')
    for p in participants:
        lines.append(f'  - "{p}"')
    lines.append(f'processed_at: "{now_iso()}"')
    lines.append(f'source: "fireflies"')
    if keywords:
        lines.append(f'keywords:')
        for kw in keywords[:15]:
            lines.append(f'  - "{kw}"')
    lines.append("---")
    lines.append("")
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"**Date:** {date_str}  ")
    lines.append(f"**Duration:** {format_duration(duration)}  ")
    lines.append(f"**Organizer:** {organizer}  ")
    lines.append(f"**Participants:** {', '.join(participants) if participants else 'unknown'}  ")
    if transcript_url:
        lines.append(f"**Fireflies URL:** {transcript_url}  ")
    lines.append("")

    # Overview
    lines.append("## Overview")
    lines.append("")
    lines.append(overview)
    lines.append("")

    # Key Bullets
    if bullets:
        lines.append("## Key Points")
        lines.append("")
        for bullet in bullets:
            lines.append(f"- {bullet}")
        lines.append("")

    # Outline
    if outline:
        lines.append("## Meeting Outline")
        lines.append("")
        for item in outline:
            lines.append(f"- {item}")
        lines.append("")

    # Action Items
    if action_items:
        lines.append("## Action Items")
        lines.append("")
        for i, item in enumerate(action_items, 1):
            lines.append(f"{i}. {item}")
        lines.append("")

    # Transcript
    if sentences:
        lines.append("## Transcript")
        lines.append("")
        current_speaker = None
        for s in sentences:
            speaker = s.get("speaker_name", "Unknown")
            text = s.get("text", "")
            timestamp = format_timestamp(s.get("start_time", 0))
            if speaker != current_speaker:
                lines.append("")
                lines.append(f"**{speaker}** [{timestamp}]:")
                current_speaker = speaker
            lines.append(f"> {text}")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Task File Generation
# ---------------------------------------------------------------------------

def get_next_task_id(prefix: str = "MTG") -> str:
    """Generate the next sequential task ID for meeting-derived tasks."""
    existing = sorted(TASKS_DIR.glob(f"{prefix}-*.md"))
    if not existing:
        return f"{prefix}-001"
    nums = []
    for p in existing:
        m = re.match(rf"{prefix}-(\d+)\.md$", p.name)
        if m:
            nums.append(int(m.group(1)))
    return f"{prefix}-{max(nums) + 1:03d}" if nums else f"{prefix}-001"


def parse_action_item_owner(action_text: str) -> Tuple[str, bool]:
    """
    Determine if an action item is assigned to Christian or his team.
    Returns (owner_name, is_christian_team).
    """
    lower = action_text.lower()
    for ident in CHRISTIAN_IDENTIFIERS:
        if ident in lower:
            return "christian", True

    # Common patterns: "X will ...", "X to ...", "X should ..."
    assign_match = re.match(r"^([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+(will|to|should|needs to|must)\s+", action_text)
    if assign_match:
        return assign_match.group(1).lower(), False

    # If no clear owner, assume it's relevant (err on side of capturing)
    return "unassigned", True


def parse_deadline_from_action(action_text: str) -> Optional[str]:
    """
    Try to extract a deadline date from action item text.
    Looks for patterns like 'by Friday', 'by March 20', 'before end of week', 'by EOD'.
    """
    lower = action_text.lower()

    # Explicit date patterns: "by March 20", "by 3/20", "before April 1"
    date_match = re.search(
        r"(?:by|before|due|deadline)\s+(\w+\s+\d{1,2}(?:,?\s*\d{4})?)",
        lower,
    )
    if date_match:
        return date_match.group(1).strip()

    # Day-of-week: "by Friday", "by Monday"
    dow_match = re.search(
        r"(?:by|before)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)",
        lower,
    )
    if dow_match:
        return dow_match.group(1).strip()

    # Relative: "by end of week", "by EOD", "by end of day", "by EOW"
    if any(phrase in lower for phrase in ["by eod", "by end of day", "end of day"]):
        return "end of day"
    if any(phrase in lower for phrase in ["by eow", "by end of week", "end of week"]):
        return "end of week"

    return None


def create_task_file(
    action_text: str,
    meeting_title: str,
    meeting_id: str,
    meeting_date: str,
    owner: str,
    task_id: str,
) -> Path:
    """Create a canonical task file for a meeting action item."""
    # Truncate title for task title
    task_title = action_text[:120]
    if len(action_text) > 120:
        task_title += "..."

    deadline = parse_deadline_from_action(action_text)
    deadline_line = f'deadline: "{deadline}"' if deadline else 'deadline:'

    content = dedent(f"""\
    ---
    id: "{task_id}"
    title: "{task_title}"
    status: "queued"
    priority: "medium"
    owner_agent: "notes"
    agent_type: "notes"
    created_at: "{now_iso()}"
    updated_at: "{now_iso()}"
    source: "meeting:{meeting_id}"
    {deadline_line}
    depends_on:
    blocked_by:
    tags:
      - "meeting-action"
      - "fireflies"
    artifacts:
      - "{MEETINGS_DIR / '*'}{meeting_id[:8]}*.md"
    ---

    ## Summary

    {action_text}

    ## Source Meeting

    - **Meeting:** {meeting_title}
    - **Meeting ID:** {meeting_id}
    - **Meeting Date:** {meeting_date}
    - **Owner:** {owner}

    ## Acceptance

    - [ ] Action item completed
    - [ ] Outcome communicated to relevant parties

    ## Activity Log

    - {now_iso()} meeting-processor: Auto-created from Fireflies meeting action item.
    """)

    task_path = TASKS_DIR / f"{task_id}.md"
    ensure_dir(TASKS_DIR)
    task_path.write_text(content)
    return task_path


# ---------------------------------------------------------------------------
# Commitment Records
# ---------------------------------------------------------------------------

def create_commitment_record(
    action_text: str,
    owner: str,
    meeting_title: str,
    meeting_id: str,
    meeting_date: str,
    task_id: Optional[str] = None,
) -> dict:
    """Create a Boswell commitment record."""
    deadline = parse_deadline_from_action(action_text)
    record = {
        "id": f"commit-{hashlib.sha256(f'{meeting_id}:{action_text}'.encode()).hexdigest()[:12]}",
        "type": "commitment",
        "text": action_text,
        "owner": owner,
        "source": "fireflies",
        "meeting_id": meeting_id,
        "meeting_title": meeting_title,
        "meeting_date": meeting_date,
        "task_id": task_id,
        "deadline": deadline,
        "status": "open",
        "created_at": now_iso(),
    }
    return record


def append_commitment(record: dict) -> None:
    """Append a commitment record to boswell-commitments.jsonl."""
    ensure_dir(COMMITMENTS_FILE.parent)

    # Idempotency: check if this commitment ID already exists
    if COMMITMENTS_FILE.exists():
        existing_text = COMMITMENTS_FILE.read_text(errors="ignore")
        if record["id"] in existing_text:
            log.info(f"Commitment {record['id']} already exists, skipping")
            return

    with COMMITMENTS_FILE.open("a") as f:
        f.write(json.dumps(record, default=str) + "\n")
    log.info(f"Appended commitment {record['id']}")


# ---------------------------------------------------------------------------
# Calendar Event Creation
# ---------------------------------------------------------------------------

def resolve_deadline_date(deadline_text: str) -> Optional[str]:
    """
    Try to resolve a deadline description into an ISO date string.
    Returns None if it cannot be resolved.
    """
    if not deadline_text:
        return None

    now = datetime.now(timezone.utc)

    if deadline_text == "end of day":
        eod = now.replace(hour=17, minute=0, second=0, microsecond=0)
        if eod < now:
            eod += timedelta(days=1)
        return eod.isoformat(timespec="seconds")

    if deadline_text == "end of week":
        days_until_friday = (4 - now.weekday()) % 7
        if days_until_friday == 0 and now.hour >= 17:
            days_until_friday = 7
        friday = (now + timedelta(days=days_until_friday)).replace(
            hour=17, minute=0, second=0, microsecond=0
        )
        return friday.isoformat(timespec="seconds")

    # Day-of-week resolution
    day_map = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }
    if deadline_text.lower() in day_map:
        target_day = day_map[deadline_text.lower()]
        days_ahead = (target_day - now.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        target = (now + timedelta(days=days_ahead)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
        return target.isoformat(timespec="seconds")

    # Try to parse explicit date strings
    for fmt in ["%B %d %Y", "%B %d", "%m/%d/%Y", "%m/%d"]:
        try:
            parsed = datetime.strptime(deadline_text, fmt)
            # If no year was in the format, use current year
            if parsed.year == 1900:
                parsed = parsed.replace(year=now.year)
                # If the date already passed this year, use next year
                if parsed.replace(tzinfo=timezone.utc) < now:
                    parsed = parsed.replace(year=now.year + 1)
            parsed = parsed.replace(hour=9, minute=0, second=0, tzinfo=timezone.utc)
            return parsed.isoformat(timespec="seconds")
        except ValueError:
            continue

    return None


def create_calendar_event_command(
    action_text: str,
    deadline_text: str,
    meeting_title: str,
    dry_run: bool = False,
) -> Optional[str]:
    """
    Generate and optionally execute a gws calendar event creation command
    for a deadline-bearing action item.
    """
    resolved_date = resolve_deadline_date(deadline_text)
    if not resolved_date:
        log.warning(f"Could not resolve deadline '{deadline_text}' to a date")
        return None

    # Parse to get end time (1 hour after start for a reminder block)
    try:
        start_dt = datetime.fromisoformat(resolved_date)
        end_dt = start_dt + timedelta(hours=1)
    except ValueError:
        return None

    event_summary = f"DEADLINE: {action_text[:80]}"
    event_desc = (
        f"Auto-created from meeting: {meeting_title}\n\n"
        f"Action item: {action_text}\n\n"
        f"Deadline: {deadline_text}"
    )

    event_json = json.dumps({
        "summary": event_summary,
        "description": event_desc,
        "start": {
            "dateTime": start_dt.isoformat(),
            "timeZone": "America/Phoenix",
        },
        "end": {
            "dateTime": end_dt.isoformat(),
            "timeZone": "America/Phoenix",
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "popup", "minutes": 60},
                {"method": "popup", "minutes": 1440},
            ],
        },
    })

    cmd = (
        f"gws calendar events insert "
        f"--params '{{\"calendarId\":\"primary\"}}' "
        f"--json '{event_json}'"
    )

    if dry_run:
        log.info(f"[DRY RUN] Would create calendar event: {cmd}")
        return cmd

    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0:
            log.info(f"Created calendar event for deadline: {deadline_text}")
            return cmd
        else:
            log.warning(f"Calendar event creation failed: {result.stderr}")
            return cmd  # Return the command anyway so it can be run manually
    except (subprocess.TimeoutExpired, Exception) as e:
        log.warning(f"Calendar event creation error: {e}")
        return cmd


# ---------------------------------------------------------------------------
# Gmail Correlation
# ---------------------------------------------------------------------------

def search_related_emails(participants: List[str], meeting_title: str) -> List[dict]:
    """
    Search Gmail for related emails from meeting participants.
    Uses gws gmail to find recent threads involving the same people/topics.
    """
    related = []

    # Search by participant email addresses
    email_participants = [p for p in participants if "@" in p]

    for email in email_participants[:5]:  # Cap to avoid excessive API calls
        query = f"from:{email} OR to:{email}"
        cmd = (
            f"gws gmail users messages list "
            f"--params '{{\"userId\":\"me\",\"maxResults\":5,"
            f"\"q\":\"{query}\"}}'"
        )
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=15,
            )
            if result.returncode == 0 and result.stdout.strip():
                try:
                    data = json.loads(result.stdout)
                    messages = data.get("messages", [])
                    for msg in messages[:3]:
                        related.append({
                            "participant": email,
                            "message_id": msg.get("id", ""),
                            "thread_id": msg.get("threadId", ""),
                        })
                except json.JSONDecodeError:
                    pass
        except (subprocess.TimeoutExpired, Exception) as e:
            log.warning(f"Gmail search error for {email}: {e}")

    # Search by meeting title keywords (extract key terms)
    if meeting_title:
        # Strip common meeting prefixes
        clean_title = re.sub(
            r"^(meeting|call|sync|standup|check.?in|weekly|daily|monthly)\s*[-:]\s*",
            "", meeting_title, flags=re.IGNORECASE,
        )
        if clean_title and len(clean_title) > 3:
            query = clean_title[:50]
            cmd = (
                f"gws gmail users messages list "
                f"--params '{{\"userId\":\"me\",\"maxResults\":5,"
                f"\"q\":\"{query}\"}}'"
            )
            try:
                result = subprocess.run(
                    cmd, shell=True, capture_output=True, text=True, timeout=15,
                )
                if result.returncode == 0 and result.stdout.strip():
                    try:
                        data = json.loads(result.stdout)
                        messages = data.get("messages", [])
                        for msg in messages[:3]:
                            related.append({
                                "participant": f"topic:{clean_title[:30]}",
                                "message_id": msg.get("id", ""),
                                "thread_id": msg.get("threadId", ""),
                            })
                    except json.JSONDecodeError:
                        pass
            except (subprocess.TimeoutExpired, Exception) as e:
                log.warning(f"Gmail topic search error: {e}")

    # Deduplicate by thread_id
    seen = set()
    deduped = []
    for r in related:
        tid = r.get("thread_id", "")
        if tid and tid not in seen:
            seen.add(tid)
            deduped.append(r)

    return deduped


# ---------------------------------------------------------------------------
# Dispatch Creation (for Boswell activity stream notification)
# ---------------------------------------------------------------------------

def create_dispatch(to_agent: str, dispatch_data: dict) -> Optional[str]:
    """Create a dispatch file in the target agent's inbox."""
    import random
    import string

    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    dispatch_id = f"dispatch-{ts}-{suffix}"

    inbox_dir = DISPATCHES_DIR / to_agent
    ensure_dir(inbox_dir)

    dispatch = {
        "id": dispatch_id,
        "from": dispatch_data.get("from", "meeting-processor"),
        "to": to_agent,
        "action": dispatch_data.get("action", "process"),
        "source": dispatch_data.get("source", "meeting-processor"),
        "subject": dispatch_data.get("subject", "(no subject)"),
        "context": dispatch_data.get("context", ""),
        "urgency": dispatch_data.get("urgency", "normal"),
        "priority": dispatch_data.get("priority", 50),
        "deadline": dispatch_data.get("deadline"),
        "sla_minutes": dispatch_data.get("sla_minutes", 60),
        "created_at": now_iso(),
        "status": "queued",
        "result": None,
    }

    dispatch_path = inbox_dir / f"{dispatch_id}.json"
    dispatch_path.write_text(json.dumps(dispatch, indent=2, default=str))
    log.info(f"Created dispatch {dispatch_id} to {to_agent}")
    return dispatch_id


# ---------------------------------------------------------------------------
# Main Processing Pipeline
# ---------------------------------------------------------------------------

def process_meeting(
    meeting_id: str,
    dry_run: bool = False,
    skip_calendar: bool = False,
    skip_gmail: bool = False,
) -> dict:
    """
    Full meeting processing pipeline.

    Returns a summary dict of everything created/found.
    """
    summary = {
        "meeting_id": meeting_id,
        "meeting_title": None,
        "meeting_date": None,
        "meeting_doc_path": None,
        "tasks_created": [],
        "commitments_created": [],
        "calendar_commands": [],
        "related_emails": [],
        "dispatches_sent": [],
        "errors": [],
        "skipped": False,
    }

    # -----------------------------------------------------------------------
    # Step 0: Idempotency check
    # -----------------------------------------------------------------------
    if is_meeting_processed(meeting_id):
        log.info(f"Meeting {meeting_id} already processed, skipping")
        summary["skipped"] = True
        return summary

    # -----------------------------------------------------------------------
    # Step 1: Fetch meeting data from Fireflies
    # -----------------------------------------------------------------------
    log.info(f"Fetching meeting data for {meeting_id}...")
    try:
        meeting = fetch_meeting_full(meeting_id)
    except RuntimeError as e:
        log.error(f"Failed to fetch meeting: {e}")
        summary["errors"].append(f"Fireflies fetch failed: {e}")
        return summary

    title = meeting.get("title", "Untitled Meeting")
    date_raw = meeting.get("date")
    date_str = (
        datetime.fromtimestamp(date_raw / 1000, tz=timezone.utc).isoformat()
        if date_raw else "unknown"
    )
    participants = meeting.get("participants") or []
    summary_data = meeting.get("summary") or {}
    action_items = summary_data.get("action_items") or []

    summary["meeting_title"] = title
    summary["meeting_date"] = date_str

    log.info(f"Meeting: {title} ({date_str})")
    log.info(f"Participants: {', '.join(participants)}")
    log.info(f"Action items found: {len(action_items)}")

    # -----------------------------------------------------------------------
    # Step 2: Generate and save meeting document
    # -----------------------------------------------------------------------
    log.info("Generating meeting document...")
    doc_content = generate_meeting_document(meeting)
    doc_path = meeting_doc_path(meeting_id, title, date_str)

    if not dry_run:
        ensure_dir(MEETINGS_DIR)
        doc_path.write_text(doc_content)
        log.info(f"Meeting document saved: {doc_path}")
    else:
        log.info(f"[DRY RUN] Would save meeting document to: {doc_path}")

    summary["meeting_doc_path"] = str(doc_path)

    # -----------------------------------------------------------------------
    # Step 3: Process action items -> tasks + commitments
    # -----------------------------------------------------------------------
    log.info("Processing action items...")
    task_counter = 0

    for action_text in action_items:
        if not action_text or not action_text.strip():
            continue

        owner, is_team = parse_action_item_owner(action_text)
        deadline = parse_deadline_from_action(action_text)

        # Create task file (for Christian's team items)
        task_id = None
        if is_team:
            task_id = get_next_task_id("MTG")
            if not dry_run:
                task_path = create_task_file(
                    action_text=action_text,
                    meeting_title=title,
                    meeting_id=meeting_id,
                    meeting_date=date_str,
                    owner=owner,
                    task_id=task_id,
                )
                log.info(f"Created task {task_id}: {task_path}")
                summary["tasks_created"].append({
                    "task_id": task_id,
                    "action": action_text[:100],
                    "owner": owner,
                    "path": str(task_path),
                })
            else:
                log.info(f"[DRY RUN] Would create task {task_id}: {action_text[:80]}")
                summary["tasks_created"].append({
                    "task_id": task_id,
                    "action": action_text[:100],
                    "owner": owner,
                    "path": "[dry run]",
                })
            task_counter += 1

        # Create commitment record (for all items, not just team)
        commitment = create_commitment_record(
            action_text=action_text,
            owner=owner,
            meeting_title=title,
            meeting_id=meeting_id,
            meeting_date=date_str,
            task_id=task_id,
        )
        if not dry_run:
            append_commitment(commitment)
        else:
            log.info(f"[DRY RUN] Would append commitment: {commitment['id']}")
        summary["commitments_created"].append(commitment)

        # Create calendar event for deadlines
        if deadline and not skip_calendar:
            cmd = create_calendar_event_command(
                action_text=action_text,
                deadline_text=deadline,
                meeting_title=title,
                dry_run=dry_run,
            )
            if cmd:
                summary["calendar_commands"].append({
                    "action": action_text[:80],
                    "deadline": deadline,
                    "command": cmd,
                })

    # -----------------------------------------------------------------------
    # Step 4: Gmail correlation
    # -----------------------------------------------------------------------
    if not skip_gmail:
        log.info("Searching for related emails...")
        try:
            related = search_related_emails(participants, title)
            summary["related_emails"] = related
            log.info(f"Found {len(related)} related email thread(s)")
        except Exception as e:
            log.warning(f"Gmail correlation failed: {e}")
            summary["errors"].append(f"Gmail correlation failed: {e}")

        # Append related emails section to meeting doc if any found
        if related and not dry_run and doc_path.exists():
            related_section = "\n## Related Email Threads\n\n"
            for r in related:
                related_section += f"- **{r['participant']}** — thread {r.get('thread_id', 'unknown')}\n"
            related_section += "\n"
            current = doc_path.read_text()
            doc_path.write_text(current + related_section)
    else:
        log.info("Skipping Gmail correlation (--skip-gmail)")

    # -----------------------------------------------------------------------
    # Step 5: Dispatch summary to Boswell and Ada
    # -----------------------------------------------------------------------
    if not dry_run:
        # Notify CD (via Boswell activity stream proxy)
        summary_text = _build_summary_text(summary)
        dispatch_id = create_dispatch("cd", {
            "from": "meeting-processor",
            "action": "meeting_processed",
            "source": "fireflies",
            "subject": f"Meeting processed: {title}",
            "context": summary_text,
            "urgency": "normal",
            "priority": 50,
        })
        if dispatch_id:
            summary["dispatches_sent"].append(dispatch_id)

        # Also notify Ada so she can index the meeting in her knowledge base
        ada_dispatch_id = create_dispatch("ada", {
            "from": "meeting-processor",
            "action": "index_meeting",
            "source": "fireflies",
            "subject": f"New meeting to index: {title}",
            "context": (
                f"A new meeting has been processed and saved to {doc_path}.\n\n"
                f"Meeting: {title}\n"
                f"Date: {date_str}\n"
                f"Participants: {', '.join(participants)}\n"
                f"Action items: {len(action_items)}\n"
                f"Tasks created: {len(summary['tasks_created'])}\n\n"
                f"Please review and add to your knowledge index."
            ),
            "urgency": "low",
            "priority": 70,
        })
        if ada_dispatch_id:
            summary["dispatches_sent"].append(ada_dispatch_id)

    log.info("Meeting processing complete.")
    return summary


def _build_summary_text(summary: dict) -> str:
    """Build a human-readable summary of what was created."""
    lines = []
    lines.append(f"Meeting processed: {summary['meeting_title']}")
    lines.append(f"Date: {summary['meeting_date']}")
    lines.append(f"Document: {summary['meeting_doc_path']}")
    lines.append("")

    if summary["tasks_created"]:
        lines.append(f"Tasks created ({len(summary['tasks_created'])}):")
        for t in summary["tasks_created"]:
            lines.append(f"  - {t['task_id']}: {t['action']}")
        lines.append("")

    if summary["commitments_created"]:
        lines.append(f"Commitments recorded: {len(summary['commitments_created'])}")
        lines.append("")

    if summary["calendar_commands"]:
        lines.append(f"Calendar events created ({len(summary['calendar_commands'])}):")
        for c in summary["calendar_commands"]:
            lines.append(f"  - {c['action']} (deadline: {c['deadline']})")
        lines.append("")

    if summary["related_emails"]:
        lines.append(f"Related email threads found: {len(summary['related_emails'])}")
        lines.append("")

    if summary["errors"]:
        lines.append(f"Errors ({len(summary['errors'])}):")
        for e in summary["errors"]:
            lines.append(f"  - {e}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Process a Fireflies meeting into OpenClaw state",
    )
    parser.add_argument(
        "meeting_id",
        help="Fireflies meeting/transcript ID",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be created without writing files",
    )
    parser.add_argument(
        "--skip-calendar",
        action="store_true",
        help="Skip calendar event creation for deadlines",
    )
    parser.add_argument(
        "--skip-gmail",
        action="store_true",
        help="Skip Gmail correlation search",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="output_json",
        help="Output summary as JSON",
    )

    args = parser.parse_args()

    try:
        summary = process_meeting(
            meeting_id=args.meeting_id,
            dry_run=args.dry_run,
            skip_calendar=args.skip_calendar,
            skip_gmail=args.skip_gmail,
        )
    except Exception as e:
        log.error(f"Fatal error processing meeting: {e}", exc_info=True)
        sys.exit(1)

    if args.output_json:
        print(json.dumps(summary, indent=2, default=str))
    else:
        print()
        print("=" * 60)
        print(_build_summary_text(summary))
        print("=" * 60)

    if summary.get("skipped"):
        sys.exit(0)
    if summary.get("errors"):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
