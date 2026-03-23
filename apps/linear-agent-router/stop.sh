#!/usr/bin/env bash
# Stop the Linear Agent Router + tunnel
cd "$(dirname "$0")"

if [ -f logs/router.pid ]; then
  kill "$(cat logs/router.pid)" 2>/dev/null && echo "Router stopped" || echo "Router not running"
  rm -f logs/router.pid
fi
if [ -f logs/tunnel.pid ]; then
  kill "$(cat logs/tunnel.pid)" 2>/dev/null && echo "Tunnel stopped" || echo "Tunnel not running"
  rm -f logs/tunnel.pid
fi
