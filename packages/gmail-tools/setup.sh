#!/bin/bash
# OpenClaw Gmail Tools — Setup Script
#
# Prerequisites:
#   1. Google Cloud Console → create/reuse project → enable Gmail API
#   2. OAuth consent screen → External → add your email as test user
#   3. Create OAuth 2.0 Client ID → Desktop application → download JSON
#   4. Place at ~/.gmail-mcp/gcp-oauth.keys.json
#
# Then run this script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$HOME/.gmail-mcp"
OAUTH_KEYS="$CONFIG_DIR/gcp-oauth.keys.json"

echo ""
echo "=== OpenClaw Gmail Tools Setup ==="
echo ""

# Check OAuth keys
if [ ! -f "$OAUTH_KEYS" ]; then
  echo "ERROR: OAuth keys not found at $OAUTH_KEYS"
  echo ""
  echo "Setup steps:"
  echo "  1. Google Cloud Console → APIs & Services → Credentials"
  echo "  2. Create OAuth 2.0 Client ID (Desktop application)"
  echo "  3. Download the JSON file"
  echo "  4. mkdir -p $CONFIG_DIR"
  echo "  5. mv ~/Downloads/client_secret_*.json $OAUTH_KEYS"
  echo "  6. Make sure Gmail API is enabled in your project"
  echo "  7. Run this script again"
  echo ""
  exit 1
fi

echo "✓ OAuth keys found"

# Install deps
echo "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install --silent 2>/dev/null
echo "✓ Dependencies installed"

# Run auth flow
echo ""
echo "Starting OAuth authorization flow..."
echo "(A browser window will NOT open — copy the URL and paste in your browser)"
echo ""
node index.mjs auth

# Register with Claude Code
echo ""
echo "Registering MCP server with Claude Code..."
claude mcp add openclaw-gmail-tools -s user -- node "$SCRIPT_DIR/index.mjs"
echo "✓ MCP server registered"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "New tools available:"
echo "  • gmail_modify_labels  — Archive, mark read, apply labels"
echo "  • gmail_batch_modify_labels — Bulk label operations"
echo "  • gmail_send_draft     — Send drafts from conversation"
echo "  • gmail_delete_draft   — Delete stale drafts"
echo "  • gmail_get_draft      — Read full draft content"
echo ""
echo "Restart Claude Code to activate."
