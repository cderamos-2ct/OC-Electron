#!/bin/bash
# Apple Notes helper — wraps Notes.app via AppleScript
# Usage:
#   apple_notes_helper.sh list [folder]
#   apple_notes_helper.sh get "<note_name>"
#   apple_notes_helper.sh create "<title>" "<body>" [folder]
#   apple_notes_helper.sh update "<note_name>" "<new_body>"
#   apple_notes_helper.sh delete "<note_name>"

CMD="${1:-list}"
ARG1="${2:-}"
ARG2="${3:-}"
ARG3="${4:-Notes}"

case "$CMD" in

list)
osascript <<APPLESCRIPT
tell application "Notes"
    set output to "["
    set allNotes to every note
    set first_item to true
    repeat with n in allNotes
        try
            set nId to id of n
            set nName to name of n
            set nMod to modification date of n as string
            set nContainer to name of container of n
            -- get body preview (first 200 chars approx)
            set nBody to body of n
            -- strip HTML tags simply by getting plaintext-like content
            set previewLen to 200
            if (length of nBody) < previewLen then set previewLen to length of nBody
            set nPreview to text 1 thru previewLen of nBody
            -- escape quotes and newlines for JSON
            set nName to my escapeJSON(nName)
            set nPreview to my escapeJSON(nPreview)
            set nId to my escapeJSON(nId)
            set nContainer to my escapeJSON(nContainer)
            if not first_item then
                set output to output & ","
            end if
            set first_item to false
            set output to output & "{\"id\":\"" & nId & "\",\"name\":\"" & nName & "\",\"folder\":\"" & nContainer & "\",\"modified\":\"" & nMod & "\",\"preview\":\"" & nPreview & "\"}"
        end try
    end repeat
    set output to output & "]"
    return output
end tell

on escapeJSON(str)
    set str to my replaceText(str, "\\", "\\\\")
    set str to my replaceText(str, "\"", "\\\"")
    set str to my replaceText(str, return, "\\n")
    set str to my replaceText(str, linefeed, "\\n")
    set str to my replaceText(str, tab, "\\t")
    return str
end escapeJSON

on replaceText(txt, find, rep)
    set {TID, AppleScript's text item delimiters} to {AppleScript's text item delimiters, find}
    set parts to text items of txt
    set AppleScript's text item delimiters to rep
    set result to parts as string
    set AppleScript's text item delimiters to TID
    return result
end replaceText
APPLESCRIPT
;;

get)
NOTE_NAME="$ARG1"
osascript <<APPLESCRIPT
tell application "Notes"
    set targetName to "$NOTE_NAME"
    set matchedNote to missing value
    repeat with n in every note
        if name of n is targetName then
            set matchedNote to n
            exit repeat
        end if
    end repeat
    if matchedNote is missing value then
        return "{\"error\":\"Note not found: $NOTE_NAME\"}"
    end if
    set nBody to body of matchedNote
    set nMod to modification date of matchedNote as string
    set nFolder to name of container of matchedNote
    -- escape for JSON
    set nName to my escapeJSON(targetName)
    set nBody to my escapeJSON(nBody)
    return "{\"name\":\"" & nName & "\",\"body\":\"" & nBody & "\",\"modified\":\"" & nMod & "\",\"folder\":\"" & nFolder & "\"}"
end tell

on escapeJSON(str)
    set str to my replaceText(str, "\\", "\\\\")
    set str to my replaceText(str, "\"", "\\\"")
    set str to my replaceText(str, return, "\\n")
    set str to my replaceText(str, linefeed, "\\n")
    set str to my replaceText(str, tab, "\\t")
    return str
end escapeJSON

on replaceText(txt, find, rep)
    set {TID, AppleScript's text item delimiters} to {AppleScript's text item delimiters, find}
    set parts to text items of txt
    set AppleScript's text item delimiters to rep
    set result to parts as string
    set AppleScript's text item delimiters to TID
    return result
end replaceText
APPLESCRIPT
;;

create)
TITLE="$ARG1"
BODY="$ARG2"
FOLDER="${ARG3:-Notes}"
osascript <<APPLESCRIPT
tell application "Notes"
    set targetFolder to missing value
    repeat with f in every folder
        if name of f is "$FOLDER" then
            set targetFolder to f
            exit repeat
        end if
    end repeat
    if targetFolder is missing value then
        -- use default folder
        set newNote to make new note with properties {name:"$TITLE", body:"$BODY"}
    else
        set newNote to make new note in targetFolder with properties {name:"$TITLE", body:"$BODY"}
    end if
    return "{\"ok\":true,\"name\":\"$TITLE\",\"folder\":\"$FOLDER\"}"
end tell
APPLESCRIPT
;;

update)
NOTE_NAME="$ARG1"
NEW_BODY="$ARG2"
osascript <<APPLESCRIPT
tell application "Notes"
    set targetName to "$NOTE_NAME"
    set matched to false
    repeat with n in every note
        if name of n is targetName then
            set body of n to "$NEW_BODY"
            set matched to true
            exit repeat
        end if
    end repeat
    if matched then
        return "{\"ok\":true}"
    else
        return "{\"error\":\"Note not found\"}"
    end if
end tell
APPLESCRIPT
;;

delete)
NOTE_NAME="$ARG1"
osascript <<APPLESCRIPT
tell application "Notes"
    set targetName to "$NOTE_NAME"
    repeat with n in every note
        if name of n is targetName then
            delete n
            return "{\"ok\":true}"
        end if
    end repeat
    return "{\"error\":\"Note not found\"}"
end tell
APPLESCRIPT
;;

folders)
osascript <<APPLESCRIPT
tell application "Notes"
    set output to ""
    repeat with f in every folder
        set output to output & name of f & "\n"
    end repeat
    return output
end tell
APPLESCRIPT
;;

*)
  echo "{\"error\":\"Unknown command: $CMD\"}"
  ;;
esac
