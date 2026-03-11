#!/bin/bash
# Search macOS Contacts by name. Usage: search_contacts.sh <query>
# Returns: name | phone | email for each match
query="${1:?Usage: search_contacts.sh <query>}"
osascript -e "
tell application \"Contacts\"
    set matchedPeople to every person whose name contains \"$query\"
    set output to \"\"
    repeat with p in matchedPeople
        set pName to name of p
        set pPhones to \"\"
        set pEmails to \"\"
        try
            repeat with ph in phones of p
                set pPhones to pPhones & (label of ph) & \": \" & (value of ph) & \"; \"
            end repeat
        end try
        try
            repeat with em in emails of p
                set pEmails to pEmails & (value of em) & \"; \"
            end repeat
        end try
        set output to output & pName & \" | phones: \" & pPhones & \"| email: \" & pEmails & \"\n\"
    end repeat
    return output
end tell
"
