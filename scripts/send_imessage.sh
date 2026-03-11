#!/bin/bash
# Send iMessage. Usage: send_imessage.sh <phone_or_email> <message>
# Phone numbers should include +1 country code (e.g. +16025408882)
recipient="${1:?Usage: send_imessage.sh <phone_or_email> <message>}"
message="${2:?Provide a message}"

# Auto-add +1 if it's a 10-digit US number
if [[ "$recipient" =~ ^[0-9]{10}$ ]]; then
    recipient="+1${recipient}"
elif [[ "$recipient" =~ ^1[0-9]{10}$ ]]; then
    recipient="+${recipient}"
fi

osascript -e "tell application \"Messages\" to send \"$message\" to buddy \"$recipient\""
echo "✅ Sent to $recipient"
