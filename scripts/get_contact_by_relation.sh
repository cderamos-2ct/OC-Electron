#!/bin/bash
# Find contact by relationship label (wife, spouse, etc). Usage: get_contact_by_relation.sh <relation>
relation="${1:?Usage: get_contact_by_relation.sh <relation>}"
osascript -e "
tell application \"Contacts\"
    set output to \"\"
    repeat with p in every person
        try
            repeat with r in related names of p
                if label of r contains \"$relation\" then
                    set pName to name of p
                    set pPhone to \"\"
                    try
                        set pPhone to value of first phone of p
                    end try
                    set output to output & pName & \" | \" & pPhone & \"\n\"
                end if
            end repeat
        end try
    end repeat
    return output
end tell
"
