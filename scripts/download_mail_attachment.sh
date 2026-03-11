#!/bin/bash
# Download a Gmail attachment to the comms artifact space.
# Usage: download_mail_attachment.sh <message_id> <attachment_id> [filename] [output_dir]

MSG_ID="${1:?Usage: download_mail_attachment.sh <message_id> <attachment_id> [filename] [output_dir]}"
ATTACH_ID="${2:?Usage: download_mail_attachment.sh <message_id> <attachment_id> [filename] [output_dir]}"
FILENAME="${3:-}"
OUTPUT_DIR="${4:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="${SCRIPT_DIR}/google_helper.py"

if [[ -n "$FILENAME" && -n "$OUTPUT_DIR" ]]; then
  exec python3 -W ignore "$HELPER" gmail_attachment_get "$MSG_ID" "$ATTACH_ID" "$FILENAME" "$OUTPUT_DIR"
elif [[ -n "$FILENAME" ]]; then
  exec python3 -W ignore "$HELPER" gmail_attachment_get "$MSG_ID" "$ATTACH_ID" "$FILENAME"
else
  exec python3 -W ignore "$HELPER" gmail_attachment_get "$MSG_ID" "$ATTACH_ID"
fi
