#!/bin/bash
# Get reminders/tasks from Reminders.app
# Usage: get_reminders.sh [list_name] [show_completed]

LIST_NAME="${1:-}"
SHOW_COMPLETED="${2:-0}"

# Warm Reminders first so AppleScript queries do not fail on a cold launch.
/usr/bin/open -ga Reminders >/dev/null 2>&1 || true

osascript <<APPLESCRIPT
tell application "Reminders"
    set output to ""

    if "$LIST_NAME" is "" then
        set targetLists to every list
    else
        set targetLists to {list "$LIST_NAME"}
    end if

    repeat with rList in targetLists
        set lName to name of rList
        if $SHOW_COMPLETED = 1 then
            set rems to every reminder of rList
        else
            set rems to (every reminder of rList whose completed is false)
        end if

        if (count of rems) > 0 then
            set output to output & "📋 " & lName & ":\n"
            repeat with r in rems
                set rName to name of r
                set rDone to completed of r
                set rDue to ""
                try
                    set dueValue to due date of r
                    if dueValue is not missing value then
                        set rDue to " (due: " & (dueValue as string) & ")"
                    end if
                end try
                set rPriority to ""
                try
                    set p to priority of r
                    if p is 1 then set rPriority to " ‼️"
                    if p is 5 then set rPriority to " ❗"
                end try
                if rDone then
                    set output to output & "  ✅ " & rName & rDue & "\n"
                else
                    set output to output & "  ⬜ " & rName & rDue & rPriority & "\n"
                end if
            end repeat
            set output to output & "\n"
        end if
    end repeat

    if output is "" then
        return "No reminders found."
    end if
    return output
end tell
APPLESCRIPT
