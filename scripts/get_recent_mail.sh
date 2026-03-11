#!/bin/bash
# Get recent emails from inbox.
# Usage: get_recent_mail.sh [limit] [unread_only]

LIMIT="${1:-10}"
UNREAD_ONLY="${2:-0}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="${SCRIPT_DIR}/google_helper.py"

if [[ "$UNREAD_ONLY" == "1" ]]; then
    exec python3 -W ignore "$HELPER" gmail_unread "$LIMIT"
fi

exec python3 -W ignore "$HELPER" gmail_recent "$LIMIT"
