#!/usr/bin/env python3
"""
OpenClaw Meeting Watcher — Polls Gmail for Fireflies recap emails and
triggers meeting-processor.py for each new meeting.

Daemon behavior:
  - Polls Gmail every 5 minutes for unread emails from fred@fireflies.ai
  - Extracts the Fireflies meeting ID from the email body URL
  - Calls meeting-processor.py for each new meeting
  - Marks the Fireflies email as read and archives it
  - Dispatches a summary to Christian via the dispatch system
  - Logs all processing to .antigravity/runtime/meeting-processing.log

Usage:
    python3 meeting-watcher.py              # Run as daemon (polls every 5 min)
    python3 meeting-watcher.py --once       # Run a single poll cycle and exit
    python3 meeting-watcher.py --interval 120  # Custom poll interval (seconds)
"""

import os
import sys
import json
import re
import subprocess
import time
import logging
import signal
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = Path("/Volumes/Storage/OpenClaw")
RUNTIME_DIR = BASE_DIR / ".antigravity" / "runtime"
LOG_FILE = RUNTIME_DIR / "meeting-processing.log"
STATE_FILE = RUNTIME_DIR / "meeting-watcher-state.json"
PROCESSOR_SCRIPT = BASE_DIR / "apps" / "runtime" / "meeting-processor.py"
DISPATCHES_DIR = RUNTIME_DIR / "dispatches"

FIREFLIES_SENDER = "fred@fireflies.ai"
DEFAULT_POLL_INTERVAL = 300  # 5 minutes

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
log = logging.getLogger("meeting-watcher")


def _setup_file_logging():
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    fh = logging.FileHandler(str(LOG_FILE), mode="a")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    log.addHandler(fh)


_setup_file_logging()

# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------

_shutdown = False


def _handle_signal(signum, frame):
    global _shutdown
    log.info(f"Received signal {signum}, shutting down gracefully...")
    _shutdown = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)

# ---------------------------------------------------------------------------
# State persistence (tracks processed email IDs to avoid re-processing)
# ---------------------------------------------------------------------------


def load_state() -> dict:
    """Load watcher state from disk."""
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except (json.JSONDecodeError, OSError) as e:
            log.warning(f"Could not load state file: {e}")
    return {
        "processed_email_ids": [],
        "processed_meeting_ids": [],
        "last_poll_at": None,
        "total_meetings_processed": 0,
    }


def save_state(state: dict) -> None:
    """Persist watcher state to disk."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        STATE_FILE.write_text(json.dumps(state, indent=2, default=str))
    except OSError as e:
        log.error(f"Could not save state: {e}")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Gmail operations via gws CLI
# ---------------------------------------------------------------------------


def search_fireflies_emails() -> List[dict]:
    """
    Search Gmail for unread emails from fred@fireflies.ai.
    Returns a list of message stubs with id and threadId.
    """
    query = f"from:{FIREFLIES_SENDER} is:unread"
    cmd = (
        f"gws gmail users messages list "
        f"--params '{{\"userId\":\"me\",\"maxResults\":10,"
        f"\"q\":\"{query}\"}}'"
    )
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=20,
        )
        if result.returncode != 0:
            log.warning(f"Gmail search failed (exit {result.returncode}): {result.stderr[:200]}")
            return []
        if not result.stdout.strip():
            return []
        data = json.loads(result.stdout)
        return data.get("messages", [])
    except subprocess.TimeoutExpired:
        log.warning("Gmail search timed out")
        return []
    except json.JSONDecodeError:
        log.warning(f"Gmail search returned invalid JSON: {result.stdout[:200]}")
        return []
    except Exception as e:
        log.warning(f"Gmail search error: {e}")
        return []


def get_email_body(message_id: str) -> dict:
    """
    Fetch a full email message by ID.
    Returns the parsed message data.
    """
    cmd = (
        f"gws gmail users messages get "
        f"--params '{{\"userId\":\"me\",\"id\":\"{message_id}\",\"format\":\"full\"}}'"
    )
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=20,
        )
        if result.returncode != 0:
            log.warning(f"Gmail get failed for {message_id}: {result.stderr[:200]}")
            return {}
        if not result.stdout.strip():
            return {}
        return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception) as e:
        log.warning(f"Gmail get error for {message_id}: {e}")
        return {}


def mark_email_read_and_archive(message_id: str) -> bool:
    """
    Mark a Gmail message as read and remove from inbox (archive).
    """
    cmd = (
        f"gws gmail users messages modify "
        f"--params '{{\"userId\":\"me\",\"id\":\"{message_id}\"}}' "
        f"--json '{{\"removeLabelIds\":[\"INBOX\",\"UNREAD\"]}}'"
    )
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0:
            log.info(f"Email {message_id} marked read and archived")
            return True
        else:
            log.warning(f"Failed to archive email {message_id}: {result.stderr[:200]}")
            return False
    except (subprocess.TimeoutExpired, Exception) as e:
        log.warning(f"Email archive error for {message_id}: {e}")
        return False


# ---------------------------------------------------------------------------
# Fireflies meeting ID extraction
# ---------------------------------------------------------------------------

# Fireflies URLs look like:
#   https://app.fireflies.ai/view/Meeting-Name::abcdef1234567890
#   https://app.fireflies.ai/view/title-text::MEETING_ID
# The meeting ID is the part after the last ::
# Also check for direct ID references in the email body

FIREFLIES_URL_PATTERNS = [
    # Standard Fireflies view URL with :: separator
    re.compile(r"https?://app\.fireflies\.ai/view/[^:\s]+::([a-zA-Z0-9]+)"),
    # Alternative URL format
    re.compile(r"https?://app\.fireflies\.ai/view/([a-zA-Z0-9]{20,})"),
    # Direct transcript link
    re.compile(r"https?://app\.fireflies\.ai/(?:transcript|meeting)/([a-zA-Z0-9]+)"),
    # Fallback: any fireflies.ai URL with a long alphanumeric ID
    re.compile(r"https?://[a-z.]*fireflies\.ai/[^\s]*?([a-zA-Z0-9]{20,})"),
]


def extract_meeting_id_from_email(message_data: dict) -> Optional[str]:
    """
    Extract the Fireflies meeting ID from an email message.
    Searches the email body (both plain text and HTML parts) for Fireflies URLs.
    """
    # Collect all text content from the email
    text_parts = []

    # Check snippet (always available)
    snippet = message_data.get("snippet", "")
    if snippet:
        text_parts.append(snippet)

    # Parse MIME parts for body content
    payload = message_data.get("payload", {})
    _extract_text_parts(payload, text_parts)

    combined_text = " ".join(text_parts)

    if not combined_text:
        log.warning("Email body is empty, cannot extract meeting ID")
        return None

    # Try each URL pattern
    for pattern in FIREFLIES_URL_PATTERNS:
        match = pattern.search(combined_text)
        if match:
            meeting_id = match.group(1)
            log.info(f"Extracted meeting ID: {meeting_id}")
            return meeting_id

    log.warning("No Fireflies meeting ID found in email body")
    return None


def _extract_text_parts(part: dict, collector: list) -> None:
    """Recursively extract text content from MIME parts."""
    mime_type = part.get("mimeType", "")
    body = part.get("body", {})
    data = body.get("data", "")

    if data and mime_type in ("text/plain", "text/html"):
        import base64
        try:
            decoded = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="ignore")
            collector.append(decoded)
        except Exception:
            collector.append(data)

    # Recurse into sub-parts
    for sub_part in part.get("parts", []):
        _extract_text_parts(sub_part, collector)


def get_email_subject(message_data: dict) -> str:
    """Extract the subject header from an email message."""
    payload = message_data.get("payload", {})
    headers = payload.get("headers", [])
    for h in headers:
        if h.get("name", "").lower() == "subject":
            return h.get("value", "(no subject)")
    return "(no subject)"


# ---------------------------------------------------------------------------
# Meeting processing invocation
# ---------------------------------------------------------------------------


def run_meeting_processor(meeting_id: str) -> Tuple[bool, str]:
    """
    Invoke meeting-processor.py for a given meeting ID.
    Returns (success, output_text).
    """
    cmd = [
        sys.executable, str(PROCESSOR_SCRIPT),
        meeting_id,
        "--json",
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120,
        )
        output = result.stdout.strip()
        if result.returncode == 0:
            log.info(f"Meeting processor succeeded for {meeting_id}")
            return True, output
        else:
            error_text = result.stderr.strip() or output
            log.error(f"Meeting processor failed for {meeting_id}: {error_text[:300]}")
            return False, error_text
    except subprocess.TimeoutExpired:
        log.error(f"Meeting processor timed out for {meeting_id}")
        return False, "Timeout: meeting processor did not complete within 120 seconds"
    except Exception as e:
        log.error(f"Error running meeting processor for {meeting_id}: {e}")
        return False, str(e)


# ---------------------------------------------------------------------------
# Dispatch helpers
# ---------------------------------------------------------------------------


def dispatch_summary_to_cd(
    meeting_title: str,
    meeting_id: str,
    processor_output: str,
    email_subject: str,
) -> None:
    """
    Send a summary dispatch to CD (Boswell activity stream) about what
    was processed from this meeting.
    """
    import random
    import string

    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    dispatch_id = f"dispatch-{ts}-{suffix}"

    inbox_dir = DISPATCHES_DIR / "cd"
    inbox_dir.mkdir(parents=True, exist_ok=True)

    # Try to parse the processor JSON output for a richer summary
    summary_context = f"Meeting watcher processed a Fireflies recap.\n\n"
    summary_context += f"Email subject: {email_subject}\n"
    summary_context += f"Meeting ID: {meeting_id}\n\n"

    try:
        proc_data = json.loads(processor_output)
        summary_context += f"Meeting: {proc_data.get('meeting_title', meeting_title)}\n"
        summary_context += f"Date: {proc_data.get('meeting_date', 'unknown')}\n"
        summary_context += f"Document: {proc_data.get('meeting_doc_path', 'unknown')}\n"

        tasks = proc_data.get("tasks_created", [])
        if tasks:
            summary_context += f"\nTasks created ({len(tasks)}):\n"
            for t in tasks:
                summary_context += f"  - {t.get('task_id', '?')}: {t.get('action', '?')[:80]}\n"

        commitments = proc_data.get("commitments_created", [])
        if commitments:
            summary_context += f"\nCommitments recorded: {len(commitments)}\n"

        cal = proc_data.get("calendar_commands", [])
        if cal:
            summary_context += f"\nCalendar events created: {len(cal)}\n"

        related = proc_data.get("related_emails", [])
        if related:
            summary_context += f"\nRelated email threads found: {len(related)}\n"

        errors = proc_data.get("errors", [])
        if errors:
            summary_context += f"\nErrors: {', '.join(str(e) for e in errors)}\n"
    except (json.JSONDecodeError, Exception):
        summary_context += f"\nProcessor output:\n{processor_output[:500]}\n"

    dispatch = {
        "id": dispatch_id,
        "from": "meeting-watcher",
        "to": "cd",
        "action": "meeting_recap_processed",
        "source": "fireflies",
        "subject": f"Fireflies recap processed: {meeting_title or email_subject}",
        "context": summary_context,
        "urgency": "normal",
        "priority": 50,
        "deadline": None,
        "sla_minutes": 60,
        "created_at": now_iso(),
        "status": "queued",
        "result": None,
    }

    dispatch_path = inbox_dir / f"{dispatch_id}.json"
    try:
        dispatch_path.write_text(json.dumps(dispatch, indent=2, default=str))
        log.info(f"Summary dispatch {dispatch_id} sent to CD")
    except OSError as e:
        log.error(f"Failed to write dispatch: {e}")


# ---------------------------------------------------------------------------
# Main poll cycle
# ---------------------------------------------------------------------------


def poll_cycle(state: dict) -> dict:
    """
    Execute one poll cycle:
      1. Search Gmail for unread Fireflies recap emails
      2. For each new email, extract meeting ID and process
      3. Mark emails as read and archive
      4. Update state

    Returns updated state.
    """
    log.info(f"--- Meeting watcher poll cycle at {now_iso()} ---")
    state["last_poll_at"] = now_iso()

    # Search for Fireflies recap emails
    messages = search_fireflies_emails()
    if not messages:
        log.info("No new Fireflies recap emails found")
        save_state(state)
        return state

    log.info(f"Found {len(messages)} unread Fireflies email(s)")
    processed_email_ids = set(state.get("processed_email_ids", []))
    processed_meeting_ids = set(state.get("processed_meeting_ids", []))

    for msg_stub in messages:
        msg_id = msg_stub.get("id")
        if not msg_id:
            continue

        # Skip already-processed emails
        if msg_id in processed_email_ids:
            log.info(f"Email {msg_id} already processed, skipping")
            continue

        log.info(f"Processing Fireflies email {msg_id}...")

        # Fetch full email
        message_data = get_email_body(msg_id)
        if not message_data:
            log.warning(f"Could not fetch email {msg_id}, will retry next cycle")
            continue

        email_subject = get_email_subject(message_data)
        log.info(f"Email subject: {email_subject}")

        # Extract meeting ID
        meeting_id = extract_meeting_id_from_email(message_data)
        if not meeting_id:
            log.warning(f"No meeting ID found in email {msg_id} ({email_subject}), marking read")
            mark_email_read_and_archive(msg_id)
            processed_email_ids.add(msg_id)
            continue

        # Skip already-processed meetings (from a different email or re-run)
        if meeting_id in processed_meeting_ids:
            log.info(f"Meeting {meeting_id} already processed, archiving email")
            mark_email_read_and_archive(msg_id)
            processed_email_ids.add(msg_id)
            continue

        # Run the meeting processor
        log.info(f"Running meeting processor for {meeting_id}...")
        success, output = run_meeting_processor(meeting_id)

        if success:
            # Check if it was skipped (already existed)
            try:
                proc_data = json.loads(output)
                was_skipped = proc_data.get("skipped", False)
                meeting_title = proc_data.get("meeting_title", email_subject)
            except (json.JSONDecodeError, Exception):
                was_skipped = False
                meeting_title = email_subject

            if was_skipped:
                log.info(f"Meeting {meeting_id} was already processed (idempotency)")
            else:
                log.info(f"Meeting {meeting_id} processed successfully")
                state["total_meetings_processed"] = state.get("total_meetings_processed", 0) + 1

                # Dispatch summary to Christian
                dispatch_summary_to_cd(
                    meeting_title=meeting_title,
                    meeting_id=meeting_id,
                    processor_output=output,
                    email_subject=email_subject,
                )

            processed_meeting_ids.add(meeting_id)
        else:
            log.error(f"Meeting {meeting_id} processing failed, will not archive email")
            log.error(f"Processor output: {output[:300]}")
            # Don't add to processed lists so it will be retried next cycle
            continue

        # Mark email as read and archive
        mark_email_read_and_archive(msg_id)
        processed_email_ids.add(msg_id)

    # Persist state (keep last 500 IDs to prevent unbounded growth)
    state["processed_email_ids"] = list(processed_email_ids)[-500:]
    state["processed_meeting_ids"] = list(processed_meeting_ids)[-500:]
    save_state(state)

    log.info(f"Poll cycle complete. Total meetings processed: {state.get('total_meetings_processed', 0)}")
    return state


# ---------------------------------------------------------------------------
# Daemon loop
# ---------------------------------------------------------------------------


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Poll Gmail for Fireflies recap emails and process meetings",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single poll cycle and exit",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=DEFAULT_POLL_INTERVAL,
        help=f"Poll interval in seconds (default: {DEFAULT_POLL_INTERVAL})",
    )
    args = parser.parse_args()

    state = load_state()

    if args.once:
        log.info("Running single poll cycle...")
        state = poll_cycle(state)
        save_state(state)
        sys.exit(0)

    # Daemon mode
    log.info(f"Meeting watcher daemon starting. Poll interval: {args.interval}s")
    log.info(f"State file: {STATE_FILE}")
    log.info(f"Log file: {LOG_FILE}")
    log.info(f"Processor: {PROCESSOR_SCRIPT}")

    while not _shutdown:
        try:
            state = poll_cycle(state)
        except KeyboardInterrupt:
            log.info("Daemon stopped by user.")
            break
        except Exception as e:
            log.error(f"Poll cycle error: {e}", exc_info=True)

        if _shutdown:
            break

        log.info(f"Sleeping {args.interval}s until next poll...")
        # Sleep in small increments to allow graceful shutdown
        for _ in range(args.interval):
            if _shutdown:
                break
            time.sleep(1)

    save_state(state)
    log.info("Meeting watcher daemon stopped.")


if __name__ == "__main__":
    main()
