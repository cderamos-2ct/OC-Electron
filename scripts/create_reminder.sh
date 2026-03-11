#!/bin/bash
# Create a new reminder
# Usage: create_reminder.sh <title> [list_name] [due_date] [notes]
# Date format: "February 22, 2026 at 2:00 PM"
# Examples:
#   create_reminder.sh "Buy groceries"
#   create_reminder.sh "Call client" "Tasks" "February 22, 2026 at 3:00 PM"

TITLE="${1:?Usage: create_reminder.sh <title> [list_name] [due_date] [notes]}"
LIST_NAME="${2:-Reminders}"
DUE_DATE="${3:-}"
NOTES="${4:-}"

osascript <<EOF
tell application "Reminders"
    set targetList to list "$LIST_NAME"
    if "$DUE_DATE" is "" then
        set newReminder to make new reminder in targetList with properties {name:"$TITLE"}
    else
        set dueD to date "$DUE_DATE"
        set newReminder to make new reminder in targetList with properties {name:"$TITLE", due date:dueD}
    end if
    if "$NOTES" is not "" then
        set body of newReminder to "$NOTES"
    end if
    return "✅ Reminder created: $TITLE" & ((" (due: " & "$DUE_DATE" & ")") as string)
end tell
EOF