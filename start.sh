#!/bin/bash
# OpenClaw runtime — Start the server and Cloudflare tunnel
# Usage: ./start.sh [--no-tunnel]

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8420
LOG_DIR="$DIR/logs"
mkdir -p "$LOG_DIR"

echo "🚀 Starting OpenClaw runtime..."

# Kill any existing server on port 8420
lsof -ti:$PORT | xargs kill -9 2>/dev/null && echo "  Killed existing server on :$PORT" || true

# Start FastAPI server
echo "  Starting server on http://0.0.0.0:$PORT"
mkdir -p "$DIR/data"
python3 "$DIR/apps/runtime/server.py" >> "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "  Server PID: $SERVER_PID"
echo $SERVER_PID > "$DIR/data/server.pid"

# Wait for server to be ready
sleep 2
if ! lsof -ti:$PORT > /dev/null 2>&1; then
    echo "❌ Server failed to start. Check logs/server.log"
    exit 1
fi
echo "  ✅ Server running at http://localhost:$PORT"

# Start Cloudflare tunnel (unless --no-tunnel)
if [[ "$1" != "--no-tunnel" ]]; then
    echo "  Starting Cloudflare tunnel..."
    cloudflared tunnel run >> "$LOG_DIR/cloudflare.log" 2>&1 &
    CF_PID=$!
    echo "  Cloudflare PID: $CF_PID"
    echo $CF_PID > "$DIR/data/cloudflare.pid"
    sleep 2
    echo "  ✅ Tunnel running — check ~/.cloudflared/config.yml for your URL"
fi

# Start Boswell activity sensor
echo "  Starting Boswell activity sensor..."
python3 "$DIR/apps/runtime/boswell-sensor.py" --daemon
SENSOR_PID=$(cat "${OPENCLAW_DATA_DIR:-/Volumes/Storage/OpenClaw-Data}/runtime/boswell-sensor.pid" 2>/dev/null)
if [ -n "$SENSOR_PID" ]; then
    echo "  ✅ Boswell sensor running (PID $SENSOR_PID)"
else
    echo "  ⚠ Boswell sensor failed to start (non-critical)"
fi

# Start meeting watcher (Ada's pipeline)
echo "  Starting meeting watcher..."
python3 "$DIR/apps/runtime/meeting-watcher.py" >> "$LOG_DIR/meeting-watcher.log" 2>&1 &
MW_PID=$!
echo "  Meeting watcher PID: $MW_PID"
echo $MW_PID > "$DIR/data/meeting-watcher.pid"
echo "  ✅ Meeting watcher running (polls every 5 min)"

echo ""
echo "✅ OpenClaw runtime is running!"
echo "   Local:   http://localhost:$PORT"
echo "   Tunnel:  https://ag.visualgraphx.com (after DNS is configured)"
echo "   Logs:    $LOG_DIR/"
echo ""
echo "To stop: kill \$(cat $DIR/data/server.pid) \$(cat $DIR/data/cloudflare.pid 2>/dev/null)"
