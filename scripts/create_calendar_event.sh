#!/bin/bash
# Create a Google Calendar event
# Usage: create_calendar_event.sh <title> <start_datetime> <end_datetime> [calendar] [location] [notes]
# Date format: "February 22, 2026 at 2:00 PM"
# Example: create_calendar_event.sh "Team Standup" "February 22, 2026 at 10:00 AM" "February 22, 2026 at 10:30 AM" "Work" "Zoom" "Weekly sync"

TITLE="${1:?Usage: create_calendar_event.sh <title> <start> <end> [calendar] [location] [notes]}"
START="${2:?Provide start datetime}"
END="${3:?Provide end datetime}"
CALENDAR="${4:-Calendar}"
LOCATION="${5:-}"
NOTES="${6:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="${SCRIPT_DIR}/google_helper.py"

START_ISO="$(
python3 - "$START" <<'PY'
import sys
from datetime import datetime

value = sys.argv[1]
if "T" in value:
    print(value)
else:
    print(datetime.strptime(value, "%B %d, %Y at %I:%M %p").strftime("%Y-%m-%dT%H:%M:%S-07:00"))
PY
)"

END_ISO="$(
python3 - "$END" <<'PY'
import sys
from datetime import datetime

value = sys.argv[1]
if "T" in value:
    print(value)
else:
    print(datetime.strptime(value, "%B %d, %Y at %I:%M %p").strftime("%Y-%m-%dT%H:%M:%S-07:00"))
PY
)"

DESCRIPTION="$NOTES"
if [[ -n "$LOCATION" ]]; then
    if [[ -n "$DESCRIPTION" ]]; then
        DESCRIPTION="Location: $LOCATION"$'\n'"$DESCRIPTION"
    else
        DESCRIPTION="Location: $LOCATION"
    fi
fi

exec python3 -W ignore "$HELPER" calendar_create "$TITLE" "$START_ISO" "$END_ISO" "$DESCRIPTION"
