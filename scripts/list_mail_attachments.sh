#!/bin/bash
# List Gmail attachments for a message id.
# Usage: list_mail_attachments.sh <message_id>

MSG_ID="${1:?Usage: list_mail_attachments.sh <message_id>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="${SCRIPT_DIR}/google_helper.py"

exec python3 -W ignore "$HELPER" gmail_attachments "$MSG_ID"
