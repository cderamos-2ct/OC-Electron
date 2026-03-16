#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${OPENCLAW_DASHBOARD_SMOKE_URL:-http://127.0.0.1:3000}"

home_html="$(curl -fsS "$BASE_URL/")"
chat_html="$(curl -fsS "$BASE_URL/chat")"

grep -q "shell-topbar" <<<"$home_html" || {
  echo "error: home page missing shell-topbar" >&2
  exit 1
}

grep -q "shell-command-rail" <<<"$home_html" || {
  echo "error: home page missing shell-command-rail" >&2
  exit 1
}

grep -q "Home dashboard + operator console" <<<"$home_html" || {
  echo "error: home page missing expected shell branding" >&2
  exit 1
}

grep -q "shell-command-rail" <<<"$chat_html" || {
  echo "error: chat page missing shell-command-rail" >&2
  exit 1
}

echo "verification=pass dashboard_shell_smoke"
