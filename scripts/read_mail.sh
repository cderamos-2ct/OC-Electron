#!/bin/bash
# Read a specific Gmail message by searching for a subject/query match
# Usage: read_mail.sh <subject_search>

SUBJECT="${1:?Usage: read_mail.sh <subject_search>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="${SCRIPT_DIR}/google_helper.py"

SEARCH_OUTPUT="$(python3 -W ignore "$HELPER" gmail_search "$SUBJECT" 1)"
MSG_ID="$(printf '%s\n' "$SEARCH_OUTPUT" | sed -n 's/.*\[ID: \([^]]*\)\].*/\1/p' | head -n 1)"

if [[ -z "$MSG_ID" ]]; then
    printf 'No email found with subject matching: %s\n' "$SUBJECT"
    exit 1
fi

exec python3 -W ignore "$HELPER" gmail_read "$MSG_ID"
