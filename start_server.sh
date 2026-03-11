#!/bin/bash
# AntiGravity server launcher
# Uses Homebrew Python which is not sandbox-restricted like the CLT Python

export HOME="/Users/cderamos"
export PATH="/Users/cderamos/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Volumes/Storage/antigravity
exec /Users/cderamos/antigravity-env/bin/python3 /Volumes/Storage/antigravity/server.py
