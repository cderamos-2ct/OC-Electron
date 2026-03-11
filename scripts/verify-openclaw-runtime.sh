#!/usr/bin/env bash
set -euo pipefail

GATEWAY_LABEL="ai.openclaw.gateway"
DASHBOARD_LABEL="ai.openclaw.dashboard"
TUNNEL_LABEL="com.visualgraphx.cloudflared.cd"
AUTOAPPROVE_LABEL="com.visualgraphx.openclaw.device-autoapprove"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing command: $1" >&2
    exit 1
  }
}

check_launchd_running() {
  local label="$1"
  local output
  output="$(launchctl print "gui/$(id -u)/$label" 2>/dev/null || true)"
  [[ -n "$output" ]] || {
    echo "launchd label not found: $label" >&2
    exit 1
  }
  grep -q "state = running" <<<"$output" || {
    echo "launchd label not running: $label" >&2
    exit 1
  }
}

check_port() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || {
    echo "expected TCP port not listening: $port" >&2
    exit 1
  }
}

check_absent_file() {
  local path="$1"
  [[ ! -e "$path" ]] || {
    echo "stale file still present: $path" >&2
    exit 1
  }
}

require_cmd openclaw
require_cmd launchctl
require_cmd lsof
require_cmd curl

check_launchd_running "$GATEWAY_LABEL"
check_launchd_running "$DASHBOARD_LABEL"
check_launchd_running "$TUNNEL_LABEL"
check_launchd_running "$AUTOAPPROVE_LABEL"

check_port 18789
check_port 3000
curl -fsS http://127.0.0.1:3000/ >/dev/null

status_output="$(openclaw status --deep)"
security_output="$(openclaw security audit --deep)"

grep -q "Gateway         .*reachable" <<<"$status_output" || {
  echo "gateway is not reported reachable by openclaw status" >&2
  exit 1
}
grep -q "Summary: 0 critical" <<<"$security_output" || {
  echo "security audit still reports critical findings" >&2
  exit 1
}

check_absent_file "$HOME/Library/LaunchAgents/com.antigravity.server.plist"
check_absent_file "$HOME/Library/LaunchAgents/com.antigravity.heartbeat.plist"
check_absent_file "$HOME/Library/LaunchAgents/com.antigravity.tunnel.plist"
check_absent_file "$HOME/Library/LaunchAgents/com.antigravity.cloudflared.plist"
check_absent_file "$HOME/Library/LaunchAgents/com.cloudflare.cloudflared.plist"

echo "OpenClaw runtime verification passed."
