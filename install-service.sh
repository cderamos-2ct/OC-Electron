#!/bin/bash
# AntiGravity — Install as macOS launchd service (auto-starts on login)
#
# NOTE: Logs go to ~/Library/Logs/antigravity/ — launchd cannot write logs
# through symlinks to external volumes. Project files stay on the external
# volume, accessed via ~/antigravity symlink.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
LINK="$HOME/antigravity"
PLIST_NAME="com.antigravity.server"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
HEARTBEAT_PLIST="com.antigravity.heartbeat"
HEARTBEAT_PATH="$HOME/Library/LaunchAgents/$HEARTBEAT_PLIST.plist"
TUNNEL_PLIST="com.antigravity.tunnel"
TUNNEL_PATH="$HOME/Library/LaunchAgents/$TUNNEL_PLIST.plist"

PYTHON=$(which python3.14 2>/dev/null || which python3)
LOG_DIR="$HOME/Library/Logs/antigravity"
mkdir -p "$LOG_DIR"

# Create ~/antigravity symlink so launchd uses a home-dir path
ln -sfn "$DIR" "$LINK"
echo "  -> Symlink: $LINK -> $DIR"

echo "Installing AntiGravity launchd services..."

# ── Main server service ────────────────────────────────────────────────────────
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$LINK/server.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$LINK</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/server.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/server-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$HOME/.local/bin</string>
    </dict>
</dict>
</plist>
EOF

# ── Cloudflare tunnel service ──────────────────────────────────────────────────
CLOUDFLARED=$(which cloudflared 2>/dev/null || echo "/opt/homebrew/bin/cloudflared")

cat > "$TUNNEL_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$TUNNEL_PLIST</string>
    <key>ProgramArguments</key>
    <array>
        <string>$CLOUDFLARED</string>
        <string>tunnel</string>
        <string>run</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/cloudflare.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/cloudflare-error.log</string>
</dict>
</plist>
EOF

# ── Heartbeat service (runs every 30 minutes) ─────────────────────────────────
cat > "$HEARTBEAT_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$HEARTBEAT_PLIST</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$LINK/heartbeat.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$LINK</string>
    <key>StartInterval</key>
    <integer>1800</integer>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/heartbeat.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/heartbeat-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$HOME/.local/bin</string>
    </dict>
</dict>
</plist>
EOF

# ── Load all services (modern bootstrap API) ───────────────────────────────────
launchctl bootout gui/$(id -u) "$PLIST_PATH" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST_PATH"
echo "  Server service installed: $PLIST_NAME"

launchctl bootout gui/$(id -u) "$TUNNEL_PATH" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$TUNNEL_PATH"
echo "  Tunnel service installed: $TUNNEL_PLIST"

launchctl bootout gui/$(id -u) "$HEARTBEAT_PATH" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$HEARTBEAT_PATH"
echo "  Heartbeat service installed: $HEARTBEAT_PLIST (every 30 min)"

echo ""
echo "AntiGravity services installed and running!"
echo "   Server:    http://localhost:8420"
echo "   Tunnel:    https://ag.visualgraphx.com"
echo "   Heartbeat: every 30 minutes"
echo ""
echo "Logs: $LOG_DIR/"
echo "To uninstall: ./uninstall-service.sh"
