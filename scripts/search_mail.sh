#!/bin/bash
# Search emails in Gmail
# Usage: search_mail.sh <search_term> [limit]
# Examples:
#   search_mail.sh "invoice"
#   search_mail.sh "from:john" 5

QUERY="${1:?Usage: search_mail.sh <search_term> [limit]}"
LIMIT="${2:-10}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="${SCRIPT_DIR}/google_helper.py"

exec python3 -W ignore "$HELPER" gmail_search "$QUERY" "$LIMIT"
