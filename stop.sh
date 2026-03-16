#!/bin/bash
# OpenClaw runtime — Stop local services
DIR="$(cd "$(dirname "$0")" && pwd)"

for pidfile in server cloudflare; do
    PID_FILE="$DIR/data/$pidfile.pid"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        kill "$PID" 2>/dev/null && echo "Stopped $pidfile (PID $PID)" || echo "$pidfile already stopped"
        rm -f "$PID_FILE"
    fi
done

# Stop meeting watcher
MW_PID_FILE="$DIR/data/meeting-watcher.pid"
if [ -f "$MW_PID_FILE" ]; then
    PID=$(cat "$MW_PID_FILE")
    kill "$PID" 2>/dev/null && echo "Stopped meeting watcher (PID $PID)" || echo "Meeting watcher already stopped"
    rm -f "$MW_PID_FILE"
fi

# Stop Boswell sensor
SENSOR_PID_FILE="${OPENCLAW_DATA_DIR:-/Volumes/Storage/OpenClaw-Data}/runtime/boswell-sensor.pid"
if [ -f "$SENSOR_PID_FILE" ]; then
    PID=$(cat "$SENSOR_PID_FILE")
    kill "$PID" 2>/dev/null && echo "Stopped Boswell sensor (PID $PID)" || echo "Boswell sensor already stopped"
    rm -f "$SENSOR_PID_FILE"
fi

# Also kill anything on port 8420
lsof -ti:8420 | xargs kill -9 2>/dev/null || true
echo "Done."
