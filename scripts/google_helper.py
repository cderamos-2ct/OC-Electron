#!/usr/bin/env python3
"""Google API helper for AntiGravity - Gmail, Calendar, Tasks, Keep, Contacts.
Supports multiple Google accounts via --account flag.

Usage:
  python3 google_helper.py [--account <alias>] <command> [args...]

Accounts:
  --account work      (default) Work Google Workspace
  --account personal  Personal Gmail
  --account biz2      Other business account
  To add accounts: python3 scripts/google_add_account.py <alias>
  To list accounts: python3 google_helper.py accounts

Commands:
  gmail_recent [limit]
  gmail_unread [limit]
  gmail_search <query> [limit]
  gmail_read <message_id>
  gmail_attachments <message_id>
  gmail_attachment_get <message_id> <attachment_id> [filename] [output_dir]
  gmail_send <to> <subject> <body>
  calendar_today [days_ahead]
  calendar_create <summary> <start_iso> <end_iso> [description]
  tasks_list [tasklist]
  tasks_add <title> [due_date_iso] [tasklist]
  tasks_complete <task_id> [tasklist]
  contacts_search <query>
  keep_list [limit]
  keep_search <query>
  keep_create <title> <content>
  accounts  — list all authorized accounts
"""
import sys, os, pickle, json, base64, re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from email.mime.text import MIMEText

# Credentials directory
CREDS_DIR = Path("/Users/cderamos/AI-wingman/gmail-automation")
CREDS_PATH = CREDS_DIR / "credentials.json"

# Active account (set by --account flag or default)
ACTIVE_ACCOUNT = "work"
ATTACHMENTS_DIR = Path(os.getenv("OPENCLAW_DATA_DIR", "/Volumes/Storage/OpenClaw-Data")) / "agents/profiles/comms/artifacts/email"

def _token_path(account=None):
    """Get token path for an account alias."""
    acct = account or ACTIVE_ACCOUNT
    named = CREDS_DIR / f"token_{acct}.pickle"
    if named.exists():
        return named
    # Fallback to original token.pickle for 'work' default
    if acct == "work":
        legacy = CREDS_DIR / "token.pickle"
        if legacy.exists():
            return legacy
    return named  # will fail with helpful error

def get_creds(account=None):
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    tp = _token_path(account)
    if not tp.exists():
        acct = account or ACTIVE_ACCOUNT
        print(f"ERROR: No credentials for account '{acct}'. "
              f"Run: python3 scripts/google_add_account.py {acct}", file=sys.stderr)
        sys.exit(1)
    with open(tp, "rb") as f:
        creds = pickle.load(f)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(tp, "wb") as f:
                pickle.dump(creds, f)
        else:
            acct = account or ACTIVE_ACCOUNT
            print(f"ERROR: Token expired for '{acct}'. "
                  f"Re-run: python3 scripts/google_add_account.py {acct}", file=sys.stderr)
            sys.exit(1)
    return creds

def get_service(api, version, account=None):
    from googleapiclient.discovery import build
    return build(api, version, credentials=get_creds(account))

def list_accounts():
    """List all authorized Google accounts."""
    tokens = sorted(CREDS_DIR.glob("token_*.pickle"))
    legacy = CREDS_DIR / "token.pickle"
    if not tokens and not legacy.exists():
        print("No accounts authorized yet.")
        print("Run: python3 scripts/google_add_account.py <alias>")
        return
    print("📋 Authorized Google Accounts:\n")
    seen = set()
    for tp in tokens:
        alias = tp.stem.replace("token_", "")
        try:
            with open(tp, "rb") as f:
                creds = pickle.load(f)
            from googleapiclient.discovery import build
            from google.auth.transport.requests import Request
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
            svc = build("gmail", "v1", credentials=creds)
            profile = svc.users().getProfile(userId="me").execute()
            email = profile.get("emailAddress", "?")
            default = " (default)" if alias == "work" else ""
            print(f"  ✅ {alias}{default}: {email}")
            seen.add(alias)
        except Exception as e:
            print(f"  ⚠️  {alias}: token error — {e}")
    # Check legacy token if 'work' not in named tokens
    if "work" not in seen and legacy.exists():
        try:
            with open(legacy, "rb") as f:
                creds = pickle.load(f)
            from googleapiclient.discovery import build
            from google.auth.transport.requests import Request
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
            svc = build("gmail", "v1", credentials=creds)
            profile = svc.users().getProfile(userId="me").execute()
            email = profile.get("emailAddress", "?")
            print(f"  ✅ work (default, legacy): {email}")
        except Exception as e:
            print(f"  ⚠️  work (legacy): token error — {e}")

# ── Gmail ──
def gmail_recent(limit=10):
    svc = get_service("gmail", "v1")
    results = svc.users().messages().list(
        userId="me", q="in:inbox", maxResults=int(limit)).execute()
    msgs = results.get("messages", [])
    if not msgs:
        print("Inbox is empty.")
        return
    for m in msgs:
        msg = svc.users().messages().get(
            userId="me",
            id=m["id"],
            format="metadata",
            metadataHeaders=["Subject", "From", "Date"],
        ).execute()
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        labels = msg.get("labelIds", [])
        flag = "📩" if "UNREAD" in labels else "📧"
        snippet = msg.get("snippet", "")[:100]
        print(f"{flag} {headers.get('Date', '?')[:22]}")
        print(f"   From: {headers.get('From', '?')}")
        print(f"   Subject: {headers.get('Subject', '(no subject)')}")
        if snippet:
            print(f"   {snippet}")
        print(f"   [ID: {m['id']}]")
        print()

def gmail_unread(limit=10):
    svc = get_service("gmail", "v1")
    results = svc.users().messages().list(
        userId="me", q="is:unread", maxResults=int(limit)).execute()
    msgs = results.get("messages", [])
    if not msgs:
        print("No unread emails.")
        return
    for m in msgs:
        msg = svc.users().messages().get(userId="me", id=m["id"], format="metadata",
            metadataHeaders=["Subject", "From", "Date"]).execute()
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        snippet = msg.get("snippet", "")[:100]
        print(f"📩 {headers.get('Date', '?')[:22]}")
        print(f"   From: {headers.get('From', '?')}")
        print(f"   Subject: {headers.get('Subject', '(no subject)')}")
        print(f"   {snippet}")
        print(f"   [ID: {m['id']}]")
        print()

def gmail_search(query, limit=10):
    svc = get_service("gmail", "v1")
    results = svc.users().messages().list(
        userId="me", q=query, maxResults=int(limit)).execute()
    msgs = results.get("messages", [])
    if not msgs:
        print(f"No emails matching: {query}")
        return
    for m in msgs:
        msg = svc.users().messages().get(userId="me", id=m["id"], format="metadata",
            metadataHeaders=["Subject", "From", "Date"]).execute()
        headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
        labels = msg.get("labelIds", [])
        flag = "📩" if "UNREAD" in labels else "📧"
        print(f"{flag} {headers.get('Date', '?')[:22]} | From: {headers.get('From', '?')} | {headers.get('Subject', '')}")
        print(f"   [ID: {m['id']}]")

def gmail_read(msg_id):
    svc = get_service("gmail", "v1")
    msg = svc.users().messages().get(userId="me", id=msg_id, format="full").execute()
    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
    print(f"📧 Email Details")
    print(f"From: {headers.get('From', '?')}")
    print(f"To: {headers.get('To', '?')}")
    print(f"Date: {headers.get('Date', '?')}")
    print(f"Subject: {headers.get('Subject', '(no subject)')}")
    print()
    payload = msg.get("payload", {})
    body = extract_text_body(payload)
    if body:
        # Truncate for Telegram
        if len(body) > 2000:
            body = body[:2000] + "\n... [truncated]"
        print(body)
    else:
        print(msg.get("snippet", "(no body)"))
    attachments = collect_attachments(payload)
    if attachments:
        print("\n📎 Attachments")
        for index, attachment in enumerate(attachments, start=1):
            name = attachment.get("filename") or f"attachment-{index}"
            mime = attachment.get("mimeType", "application/octet-stream")
            size = attachment.get("size", 0)
            attachment_id = attachment.get("attachmentId") or "(inline)"
            print(f"  {index}. {name} | {mime} | {size} bytes | attachmentId={attachment_id}")
        print(f"\nTo download: python3 -W ignore {__file__} gmail_attachment_get {msg_id} <attachment_id> [filename] [output_dir]")

def walk_parts(part):
    yield part
    for child in part.get("parts", []) or []:
        yield from walk_parts(child)

def decode_part_body(part):
    data = part.get("body", {}).get("data", "")
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    except Exception:
        return ""

def extract_text_body(payload):
    for part in walk_parts(payload):
        if part.get("mimeType") == "text/plain":
            body = decode_part_body(part)
            if body.strip():
                return body
    if payload.get("body", {}).get("data"):
        return decode_part_body(payload)
    return ""

def collect_attachments(payload):
    attachments = []
    for part in walk_parts(payload):
        filename = part.get("filename", "")
        body = part.get("body", {}) or {}
        attachment_id = body.get("attachmentId")
        inline_data = body.get("data")
        if not filename and not attachment_id:
            continue
        attachments.append({
            "filename": filename,
            "mimeType": part.get("mimeType", ""),
            "attachmentId": attachment_id,
            "size": body.get("size", 0),
            "inline": bool(inline_data and not attachment_id),
            "inlineData": inline_data,
        })
    return attachments

def gmail_attachments(msg_id):
    svc = get_service("gmail", "v1")
    msg = svc.users().messages().get(userId="me", id=msg_id, format="full").execute()
    attachments = collect_attachments(msg.get("payload", {}))
    if not attachments:
        print("No attachments found.")
        return
    for index, attachment in enumerate(attachments, start=1):
        name = attachment.get("filename") or f"attachment-{index}"
        mime = attachment.get("mimeType", "application/octet-stream")
        size = attachment.get("size", 0)
        attachment_id = attachment.get("attachmentId") or "(inline)"
        print(f"{index}. {name} | {mime} | {size} bytes | attachmentId={attachment_id}")

def sanitize_filename(name):
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name.strip())
    return cleaned or "attachment.bin"

def gmail_attachment_get(msg_id, attachment_ref, filename=None, output_dir=None):
    svc = get_service("gmail", "v1")
    msg = svc.users().messages().get(userId="me", id=msg_id, format="full").execute()
    attachments = collect_attachments(msg.get("payload", {}))
    match = next((a for a in attachments if (a.get("attachmentId") or "") == attachment_ref), None)
    if not match and attachment_ref.isdigit():
        index = int(attachment_ref) - 1
        if 0 <= index < len(attachments):
            match = attachments[index]
    if not match:
        match = next((a for a in attachments if (a.get("filename") or "") == attachment_ref), None)
    if not match:
        raise RuntimeError(f"Attachment not found: {attachment_ref}")

    if match.get("inline"):
        raw_data = match.get("inlineData", "")
    else:
        attachment_id = match.get("attachmentId")
        result = svc.users().messages().attachments().get(
            userId="me",
            messageId=msg_id,
            id=attachment_id,
        ).execute()
        raw_data = result.get("data", "")

    if not raw_data:
        raise RuntimeError("Attachment has no data")

    content = base64.urlsafe_b64decode(raw_data.encode())
    name = sanitize_filename(filename or match.get("filename") or attachment_ref)
    destination_dir = Path(output_dir) if output_dir else ATTACHMENTS_DIR / msg_id
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination_path = destination_dir / name
    destination_path.write_bytes(content)
    print(f"✅ Saved attachment to {destination_path}")
    print(f"MimeType: {match.get('mimeType', 'application/octet-stream')}")
    print(f"Bytes: {len(content)}")

def gmail_send(to, subject, body_text):
    svc = get_service("gmail", "v1")
    message = MIMEText(body_text)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    svc.users().messages().send(userId="me", body={"raw": raw}).execute()
    print(f"✅ Email sent to {to}: {subject}")

def gmail_archive(msg_id):
    """Archive an email by removing the INBOX label."""
    svc = get_service("gmail", "v1")
    svc.users().messages().modify(
        userId='me', id=msg_id,
        body={'removeLabelIds': ['INBOX']}
    ).execute()
    print(f"✅ Archived message {msg_id}")

def gmail_trash(msg_id):
    """Move an email to trash."""
    svc = get_service("gmail", "v1")
    svc.users().messages().trash(userId='me', id=msg_id).execute()
    print(f"✅ Trashed message {msg_id}")

def gmail_labels():
    """List all Gmail labels."""
    svc = get_service("gmail", "v1")
    results = svc.users().labels().list(userId='me').execute()
    labels = results.get('labels', [])
    if not labels:
        print("No labels found.")
        return
    for label in sorted(labels, key=lambda l: l.get('name', '')):
        ltype = label.get('type', 'user')
        print(f"🏷️ {label['name']}  [ID: {label['id']}]  ({ltype})")

# ── Calendar ──
def calendar_today(days_ahead=0):
    svc = get_service("calendar", "v3")
    # Arizona is MST (UTC-7), no daylight saving time — use local midnight
    phoenix_tz = timezone(timedelta(hours=-7))
    now = datetime.now(phoenix_tz)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=int(days_ahead) + 1)
    events = svc.events().list(
        calendarId="primary", timeMin=start.isoformat(), timeMax=end.isoformat(),
        singleEvents=True, orderBy="startTime", maxResults=25).execute()
    items = events.get("items", [])
    if not items:
        print("No events found." if int(days_ahead) == 0 else f"No events in the next {days_ahead} days.")
        return
    current_date = ""
    for e in items:
        start_str = e["start"].get("dateTime", e["start"].get("date", ""))
        end_str = e["end"].get("dateTime", e["end"].get("date", ""))
        # Format nicely
        try:
            dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            day = dt.strftime("%a %b %d")
            if day != current_date:
                current_date = day
                print(f"\n📅 {day}")
            time_str = dt.strftime("%I:%M %p")
            dt_end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            time_end = dt_end.strftime("%I:%M %p")
            print(f"  {time_str}-{time_end} | {e.get('summary', '(no title)')}")
        except:
            print(f"  {start_str} | {e.get('summary', '(no title)')}")
        loc = e.get("location", "")
        if loc:
            print(f"    📍 {loc}")

def calendar_create(summary, start_iso, end_iso, description=""):
    svc = get_service("calendar", "v3")
    event = {
        "summary": summary,
        "start": {"dateTime": start_iso, "timeZone": "America/Phoenix"},
        "end": {"dateTime": end_iso, "timeZone": "America/Phoenix"},
    }
    if description:
        event["description"] = description
    result = svc.events().insert(calendarId="primary", body=event).execute()
    print(f"✅ Created: {summary}")
    print(f"   Link: {result.get('htmlLink', '')}")

def calendar_range(start_date_str, end_date_str):
    """Fetch events between two ISO date strings (YYYY-MM-DD)."""
    svc = get_service("calendar", "v3")
    phoenix_tz = timezone(timedelta(hours=-7))
    start_d = datetime.strptime(start_date_str, "%Y-%m-%d").replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=phoenix_tz)
    end_d = datetime.strptime(end_date_str, "%Y-%m-%d").replace(
        hour=23, minute=59, second=59, microsecond=0, tzinfo=phoenix_tz)
    events = svc.events().list(
        calendarId="primary", timeMin=start_d.isoformat(), timeMax=end_d.isoformat(),
        singleEvents=True, orderBy="startTime", maxResults=100).execute()
    items = events.get("items", [])
    if not items:
        print(f"No events from {start_date_str} to {end_date_str}.")
        return
    current_date = ""
    for e in items:
        start_str = e["start"].get("dateTime", e["start"].get("date", ""))
        end_str   = e["end"].get("dateTime",   e["end"].get("date",   ""))
        try:
            dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            day = dt.strftime("%a %b %d")
            if day != current_date:
                current_date = day
                print(f"\n📅 {day}")
            time_str = dt.strftime("%I:%M %p").lstrip("0")
            dt_end   = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            time_end = dt_end.strftime("%I:%M %p").lstrip("0")
            print(f"  {time_str}-{time_end} | {e.get('summary', '(no title)')}")
        except Exception:
            print(f"  {start_str} | {e.get('summary', '(no title)')}")
        loc = e.get("location", "")
        if loc:
            print(f"    📍 {loc}")

# ── Tasks ──
def tasks_list(tasklist="@default"):
    svc = get_service("tasks", "v1")
    results = svc.tasks().list(tasklist=tasklist, showCompleted=False, maxResults=50).execute()
    items = results.get("items", [])
    if not items:
        print("No pending tasks.")
        return
    for t in items:
        due = ""
        if t.get("due"):
            try:
                dt = datetime.fromisoformat(t["due"].replace("Z", "+00:00"))
                due = f" (due: {dt.strftime('%b %d')})"
            except:
                due = f" (due: {t['due'][:10]})"
        status = "⬜" if t.get("status") != "completed" else "✅"
        print(f"{status} {t.get('title', '(untitled)')}{due}")
        print(f"   [ID: {t['id']}]")
        if t.get("notes"):
            print(f"   📝 {t['notes'][:80]}")

def tasks_add(title, due_date="", tasklist="@default"):
    svc = get_service("tasks", "v1")
    task = {"title": title}
    if due_date:
        task["due"] = due_date if "T" in due_date else due_date + "T00:00:00Z"
    result = svc.tasks().insert(tasklist=tasklist, body=task).execute()
    print(f"✅ Task added: {title}")
    if due_date:
        print(f"   Due: {due_date}")

def tasks_complete(task_id, tasklist="@default"):
    svc = get_service("tasks", "v1")
    task = svc.tasks().get(tasklist=tasklist, task=task_id).execute()
    task["status"] = "completed"
    svc.tasks().update(tasklist=tasklist, task=task_id, body=task).execute()
    print(f"✅ Completed: {task.get('title', task_id)}")

def tasks_delete(task_id, tasklist="@default"):
    """Delete a Google Task."""
    svc = get_service("tasks", "v1")
    svc.tasks().delete(tasklist=tasklist, task=task_id).execute()
    print(f"✅ Deleted task {task_id}")

def tasks_update(task_id, title="", due_date="", notes="", tasklist="@default"):
    """Update a Google Task's title, due date, or notes."""
    svc = get_service("tasks", "v1")
    task = svc.tasks().get(tasklist=tasklist, task=task_id).execute()
    if title:
        task["title"] = title
    if due_date:
        task["due"] = due_date if "T" in due_date else due_date + "T00:00:00Z"
    if notes:
        task["notes"] = notes
    result = svc.tasks().update(tasklist=tasklist, task=task_id, body=task).execute()
    print(f"✅ Updated: {result.get('title', task_id)}")

def tasks_lists():
    """List all task lists."""
    svc = get_service("tasks", "v1")
    results = svc.tasklists().list(maxResults=20).execute()
    items = results.get("items", [])
    if not items:
        print("No task lists found.")
        return
    for tl in items:
        print(f"📋 {tl.get('title', '(untitled)')}  [ID: {tl['id']}]")

# ── Google Contacts (People API) ──
def contacts_search(query):
    svc = get_service("people", "v1")
    results = svc.people().searchContacts(
        query=query, readMask="names,emailAddresses,phoneNumbers",
        pageSize=10).execute()
    contacts = results.get("results", [])
    if not contacts:
        print(f"No contacts matching: {query}")
        return
    for c in contacts:
        person = c.get("person", {})
        names = person.get("names", [{}])
        name = names[0].get("displayName", "(no name)") if names else "(no name)"
        phones = [p.get("value", "") for p in person.get("phoneNumbers", [])]
        emails = [e.get("value", "") for e in person.get("emailAddresses", [])]
        print(f"👤 {name}")
        if phones:
            print(f"   📱 {', '.join(phones)}")
        if emails:
            print(f"   📧 {', '.join(emails)}")

# ── Google Keep ──
def _get_keep():
    """Get authenticated Keep API instance using OAuth token."""
    import gkeepapi
    creds = get_creds()
    keep = gkeepapi.Keep()
    keep.authenticate(creds.token)
    return keep

def keep_list(limit=10):
    try:
        keep = _get_keep()
        notes = list(keep.all())[:int(limit)]
        if not notes:
            print("No notes found.")
            return
        for n in notes:
            icon = "📌" if n.pinned else "📝"
            title = n.title or "(untitled)"
            text = (n.text or "")[:80]
            print(f"{icon} {title}")
            if text:
                print(f"   {text}")
            if hasattr(n, 'items') and callable(getattr(n, 'items', None)):
                pass  # list items handled differently
            print()
    except Exception as e:
        if "unauthenticated" in str(e).lower() or "401" in str(e):
            print("Keep auth failed. Google Keep uses a special auth method.")
            print("Try: python3 scripts/google_reauth.py to refresh credentials")
        else:
            raise

def keep_search(query):
    try:
        keep = _get_keep()
        notes = keep.find(query=query)
        found = list(notes)[:10]
        if not found:
            print(f"No notes matching: {query}")
            return
        for n in found:
            icon = "📌" if n.pinned else "📝"
            title = n.title or "(untitled)"
            text = (n.text or "")[:120]
            print(f"{icon} {title}")
            if text:
                print(f"   {text}")
            print()
    except Exception as e:
        if "unauthenticated" in str(e).lower() or "401" in str(e):
            print("Keep auth failed. Run: python3 scripts/google_reauth.py")
        else:
            raise

def keep_create(title, content=""):
    try:
        keep = _get_keep()
        note = keep.createNote(title, content)
        keep.sync()
        print(f"✅ Note created: {title}")
    except Exception as e:
        if "unauthenticated" in str(e).lower() or "401" in str(e):
            print("Keep auth failed. Run: python3 scripts/google_reauth.py")
        else:
            raise

# ── CLI Router ──
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    # Parse --account flag
    argv = sys.argv[1:]
    if argv[0] == "--account" and len(argv) >= 3:
        ACTIVE_ACCOUNT = argv[1].lower().strip()
        argv = argv[2:]
    elif argv[0].startswith("--account="):
        ACTIVE_ACCOUNT = argv[0].split("=", 1)[1].lower().strip()
        argv = argv[1:]

    cmd = argv[0]
    args = argv[1:]

    commands = {
        "gmail_recent": lambda: gmail_recent(*args),
        "gmail_unread": lambda: gmail_unread(*args),
        "gmail_search": lambda: gmail_search(*args),
        "gmail_read": lambda: gmail_read(*args),
        "gmail_attachments": lambda: gmail_attachments(*args),
        "gmail_attachment_get": lambda: gmail_attachment_get(*args),
        "gmail_send": lambda: gmail_send(*args),
        "gmail_archive": lambda: gmail_archive(*args),
        "gmail_trash": lambda: gmail_trash(*args),
        "gmail_labels": lambda: gmail_labels(),
        "calendar_today": lambda: calendar_today(*args),
        "calendar_create": lambda: calendar_create(*args),
        "calendar_range": lambda: calendar_range(*args),
        "tasks_list": lambda: tasks_list(*args),
        "tasks_add": lambda: tasks_add(*args),
        "tasks_complete": lambda: tasks_complete(*args),
        "tasks_delete": lambda: tasks_delete(*args),
        "tasks_update": lambda: tasks_update(*args),
        "tasks_lists": lambda: tasks_lists(),
        "contacts_search": lambda: contacts_search(*args),
        "keep_list": lambda: keep_list(*args),
        "keep_search": lambda: keep_search(*args),
        "keep_create": lambda: keep_create(*args),
        "accounts": lambda: list_accounts(),
    }
    if cmd in commands:
        try:
            commands[cmd]()
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)
