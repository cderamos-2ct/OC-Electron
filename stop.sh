#!/bin/bash
# AntiGravity — Stop all services
DIR="$(cd "$(dirname "$0")" && pwd)"

for pidfile in server cloudflare; do
    PID_FILE="$DIR/data/$pidfile.pid"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        kill "$PID" 2>/dev/null && echo "Stopped $pidfile (PID $PID)" || echo "$pidfile already stopped"
        rm -f "$PID_FILE"
    fi
done

# Also kill anything on port 8420
lsof -ti:8420 | xargs kill -9 2>/dev/null || true
echo "Done."
