#!/bin/bash
# Get Google Calendar events for today or a date range.
# Usage: get_calendar_events.sh [days_ahead] [calendar_name]

DAYS="${1:-0}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="${SCRIPT_DIR}/google_helper.py"

exec python3 -W ignore "$HELPER" calendar_today "$DAYS"
