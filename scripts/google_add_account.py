#!/usr/bin/env python3
"""Add a new Google account for AntiGravity multi-account support.

Usage:
  python3 google_add_account.py <alias>

Examples:
  python3 google_add_account.py personal
  python3 google_add_account.py biz2

This will open a browser to authorize the account.
Token is saved as token_<alias>.pickle alongside existing credentials.
"""
import sys, pickle
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

CREDS_DIR = Path("/Users/cderamos/AI-wingman/gmail-automation")
CREDS_PATH = CREDS_DIR / "credentials.json"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.labels",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/documents",
]

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

alias = sys.argv[1].lower().strip()
token_path = CREDS_DIR / f"token_{alias}.pickle"

print(f"\n🔐 Adding Google account: '{alias}'")
print(f"   Token will be saved to: {token_path}")
print(f"   Scopes: {', '.join(s.split('/')[-1] for s in SCOPES)}")
print(f"\n   A browser window will open — sign in with the Google account")
print(f"   you want to use as '{alias}'.\n")

flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_PATH), SCOPES)
creds = flow.run_local_server(port=0)

with open(token_path, "wb") as f:
    pickle.dump(creds, f)

# Verify which account was authorized
from googleapiclient.discovery import build
svc = build("gmail", "v1", credentials=creds)
profile = svc.users().getProfile(userId="me").execute()
email = profile.get("emailAddress", "unknown")

print(f"\n✅ Account '{alias}' authorized successfully!")
print(f"   Email: {email}")
print(f"   Token: {token_path}")
print(f"\n   Usage: python3 google_helper.py --account {alias} gmail_unread")
