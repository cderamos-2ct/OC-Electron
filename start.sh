#!/bin/bash
# AntiGravity — Start the server and Cloudflare tunnel
# Usage: ./start.sh [--no-tunnel]

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8420
LOG_DIR="$DIR/logs"
mkdir -p "$LOG_DIR"

echo "🚀 Starting AntiGravity Command Center..."

# Kill any existing server on port 8420
lsof -ti:$PORT | xargs kill -9 2>/dev/null && echo "  Killed existing server on :$PORT" || true

# Start FastAPI server
echo "  Starting server on http://0.0.0.0:$PORT"
python3 "$DIR/server.py" >> "$LOG_DIR/server.log" 2>&1 &
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

echo ""
echo "✅ AntiGravity is running!"
echo "   Local:   http://localhost:$PORT"
echo "   Tunnel:  https://ag.visualgraphx.com (after DNS is configured)"
echo "   Logs:    $LOG_DIR/"
echo ""
echo "To stop: kill \$(cat $DIR/data/server.pid) \$(cat $DIR/data/cloudflare.pid 2>/dev/null)"
