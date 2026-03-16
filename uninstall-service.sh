#!/bin/bash
# OpenClaw runtime — Uninstall legacy launchd services
for label in com.antigravity.server com.antigravity.tunnel com.antigravity.heartbeat; do
    plist="$HOME/Library/LaunchAgents/$label.plist"
    if [ -f "$plist" ]; then
        launchctl unload "$plist" 2>/dev/null || true
        rm -f "$plist"
        echo "Removed $label"
    fi
done
lsof -ti:8420 | xargs kill -9 2>/dev/null || true
echo "Done."
