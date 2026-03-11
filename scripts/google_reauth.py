#!/usr/bin/env python3
"""Re-authenticate with expanded Google API scopes.
Run this once in a terminal to authorize new APIs (People, Docs, Keep).
A browser window will open for you to approve.
"""
import pickle
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

CREDS_DIR = Path("/Users/cderamos/AI-wingman/gmail-automation")
TOKEN_PATH = CREDS_DIR / "token.pickle"
CREDS_PATH = CREDS_DIR / "credentials.json"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/documents",
]

print("Opening browser for Google OAuth...")
print(f"Scopes: {', '.join(s.split('/')[-1] for s in SCOPES)}")
flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_PATH), SCOPES)
creds = flow.run_local_server(port=0)
with open(TOKEN_PATH, "wb") as f:
    pickle.dump(creds, f)
print(f"\n✅ Token saved with {len(SCOPES)} scopes:")
for s in SCOPES:
    print(f"  - {s.split('/')[-1]}")
print(f"\nSaved to: {TOKEN_PATH}")