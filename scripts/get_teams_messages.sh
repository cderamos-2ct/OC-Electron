#!/bin/bash
# Read recent Microsoft Teams messages from macOS Notification Center
# Usage: get_teams_messages.sh [limit] [search_query]
#        get_teams_messages.sh --since "2026-02-22 07:00:00" [limit]
#   --since flag returns only messages after that timestamp (for heartbeat)

SINCE=""
if [ "$1" = "--since" ]; then
    SINCE="$2"
    shift 2
fi
LIMIT="${1:-20}"
QUERY="${2:-}"
python3 -W ignore - "$LIMIT" "$QUERY" "$SINCE" << 'PYEND'
import sqlite3, plistlib, os, sys
from datetime import datetime, timedelta

limit = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] else 20
query = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else ''
since_str = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else ''
db_path = os.path.expanduser('~/Library/Group Containers/group.com.apple.usernoted/db2/db')
MAC_EPOCH = datetime(2001, 1, 1)

# Convert --since timestamp to macOS epoch seconds
since_epoch = 0
if since_str:
    try:
        since_dt = datetime.strptime(since_str, '%Y-%m-%d %H:%M:%S')
        since_epoch = (since_dt - MAC_EPOCH).total_seconds()
    except: pass

try:
    conn = sqlite3.connect(db_path)
    if since_epoch:
        cur = conn.execute(
            'SELECT r.delivered_date, r.data FROM record r JOIN app a ON r.app_id = a.rowid '
            'WHERE a.identifier = ? AND r.delivered_date > ? ORDER BY r.delivered_date DESC LIMIT ?',
            ('com.microsoft.teams2', since_epoch, limit * 3))
    else:
        cur = conn.execute(
            'SELECT r.delivered_date, r.data FROM record r JOIN app a ON r.app_id = a.rowid '
            'WHERE a.identifier = ? ORDER BY r.delivered_date DESC LIMIT ?',
            ('com.microsoft.teams2', limit * 3))
    messages = []
    for row in cur.fetchall():
        delivered, data = row
        if not data: continue
        try:
            plist = plistlib.loads(data)
            req = plist.get('req', {})
            body = req.get('body', '')
            titl = req.get('titl', '')
            subt = req.get('subt', '')
            if not body and not titl: continue
            dt = MAC_EPOCH + timedelta(seconds=delivered)
            channel = titl or 'Unknown'
            context = subt or ''
            msg = {'time': dt, 'channel': channel, 'context': context, 'body': body}
            if query:
                text = (channel + ' ' + context + ' ' + body).lower()
                if query.lower() not in text: continue
            messages.append(msg)
            if len(messages) >= limit: break
        except: continue
    conn.close()
    if not messages:
        if since_str: print('TEAMS_NO_NEW')
        elif query: print('No Teams messages matching: ' + query)
        else: print('No recent Teams messages found.')
        sys.exit(0)
    current_date = ''
    for m in messages:
        day = m['time'].strftime('%a %b %d')
        if day != current_date:
            current_date = day
            print()
            print('--- ' + day + ' ---')
        time_str = m['time'].strftime('%I:%M %p')
        label = m['channel']
        if m['context']: label += ' | ' + m['context']
        print('  [' + time_str + '] ' + label)
        if m['body']:
            body = m['body'][:300]
            if len(m['body']) > 300: body += '...'
            print('     ' + body)
except Exception as e:
    print('Error reading Teams notifications: ' + str(e), file=sys.stderr)
    sys.exit(1)
PYEND
