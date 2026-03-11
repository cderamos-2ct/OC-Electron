#!/bin/bash
# Get recent iMessages from Messages.app chat.db
# Usage: get_recent_imessages.sh [limit] [contact_filter]
# Examples:
#   get_recent_imessages.sh          # last 15 messages
#   get_recent_imessages.sh 20       # last 20 messages
#   get_recent_imessages.sh 10 ashley # messages with ashley

LIMIT="${1:-15}"
CONTACT="${2:-}"

DB="$HOME/Library/Messages/chat.db"

if [ ! -f "$DB" ]; then
    echo "Messages database not found."
    exit 1
fi

if [ -n "$CONTACT" ]; then
    sqlite3 "$DB" "
        SELECT
            datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as msg_time,
            CASE WHEN m.is_from_me = 1 THEN 'Me' ELSE h.id END as sender,
            m.text
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        WHERE m.text IS NOT NULL
          AND (h.id LIKE '%${CONTACT}%' OR m.text LIKE '%${CONTACT}%'
               OR h.id IN (SELECT h2.id FROM handle h2
                          JOIN chat_handle_join chj ON h2.ROWID = chj.handle_id
                          JOIN chat c ON chj.chat_id = c.ROWID
                          WHERE c.display_name LIKE '%${CONTACT}%'))
        ORDER BY m.date DESC
        LIMIT $LIMIT;
    " 2>/dev/null | while IFS='|' read -r time sender text; do
        echo "[$time] $sender: $text"
    done
else
    sqlite3 "$DB" "
        SELECT
            datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as msg_time,
            CASE WHEN m.is_from_me = 1 THEN 'Me' ELSE COALESCE(h.id, 'Unknown') END as sender,
            m.text
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        WHERE m.text IS NOT NULL
        ORDER BY m.date DESC
        LIMIT $LIMIT;
    " 2>/dev/null | while IFS='|' read -r time sender text; do
        echo "[$time] $sender: $text"
    done
fi