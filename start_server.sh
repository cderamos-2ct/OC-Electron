#!/bin/bash
# OpenClaw runtime launcher
# Uses the dedicated virtualenv Python and the repo-local runtime app.

export HOME="/Users/cderamos"
export PATH="/Users/cderamos/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Volumes/Storage/OpenClaw
exec /Users/cderamos/antigravity-env/bin/python3 /Volumes/Storage/OpenClaw/apps/runtime/server.py
