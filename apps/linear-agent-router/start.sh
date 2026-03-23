#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Start the Linear Agent Router + Cloudflare tunnel
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

PORT=${PORT:-9786}
TUNNEL_LOG="logs/tunnel.log"
ROUTER_LOG="logs/router.log"
mkdir -p logs

echo "═══════════════════════════════════════════"
echo "  Linear Agent Router — Startup"
echo "═══════════════════════════════════════════"

# 1. Start the Node router in background
echo "→ Starting webhook router on port $PORT..."
node index.mjs &
ROUTER_PID=$!
echo "  Router PID: $ROUTER_PID"

# Wait for it to be ready
sleep 1
if ! curl -sf http://localhost:$PORT/health > /dev/null 2>&1; then
  echo "❌ Router failed to start"
  kill $ROUTER_PID 2>/dev/null
  exit 1
fi

# 2. Start cloudflared tunnel
echo "→ Starting Cloudflare tunnel..."
cloudflared tunnel --url http://localhost:$PORT \
  --no-autoupdate \
  2>&1 | tee "$TUNNEL_LOG" &
TUNNEL_PID=$!
echo "  Tunnel PID: $TUNNEL_PID"

# Wait for the tunnel URL to appear
echo "→ Waiting for tunnel URL..."
for i in $(seq 1 15); do
  TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "⚠️  Tunnel URL not detected yet — check $TUNNEL_LOG"
  echo "  You can still set it up manually once it appears."
else
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  ✅ READY"
  echo ""
  echo "  Tunnel URL: $TUNNEL_URL"
  echo ""
  echo "  Set this as your Linear webhook URL:"
  echo "  → Linear Settings > API > Webhooks > New"
  echo "  → URL: $TUNNEL_URL"
  echo "  → Resource types: Issues"
  echo "═══════════════════════════════════════════"
fi

# Write PIDs for stop script
echo "$ROUTER_PID" > logs/router.pid
echo "$TUNNEL_PID" > logs/tunnel.pid

# Wait for either to exit
wait -n $ROUTER_PID $TUNNEL_PID 2>/dev/null
echo "Process exited — shutting down..."
kill $ROUTER_PID $TUNNEL_PID 2>/dev/null
