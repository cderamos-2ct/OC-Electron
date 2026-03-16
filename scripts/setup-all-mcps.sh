#!/bin/bash
# OpenClaw — One-Shot MCP Setup
# Run this when you're at your Mac. Authenticates and registers everything.

set -euo pipefail
echo ""
echo "=== OpenClaw MCP Setup ==="
echo ""

# 1. Google Workspace CLI (Gmail, Calendar, Chat, Drive, Tasks, People, Keep)
echo "--- Step 1: Google Workspace Auth ---"
echo "This will open your browser for Google OAuth consent."
echo "Granting: Gmail, Calendar, Chat, Drive, Tasks, People, Keep"
echo ""
gws auth login -s gmail,calendar,chat,drive,tasks,people,keep
echo "✓ Google Workspace authenticated"

# Register gws as MCP server
claude mcp add gws -s user -- gws mcp 2>/dev/null && echo "✓ gws MCP registered" || echo "⚠ gws MCP registration failed (may already exist)"

# 2. Gmail Tools (custom — modify labels, send drafts, etc.)
echo ""
echo "--- Step 2: Gmail Tools MCP ---"
cd /Volumes/Storage/OpenClaw/packages/gmail-tools
if [ -f ~/.gmail-mcp/credentials.json ]; then
  echo "✓ Gmail Tools already authenticated"
else
  node index.mjs auth
fi
claude mcp add openclaw-gmail-tools -s user -- node /Volumes/Storage/OpenClaw/packages/gmail-tools/index.mjs 2>/dev/null && echo "✓ Gmail Tools MCP registered" || echo "⚠ Gmail Tools MCP registration failed (may already exist)"

# 3. Fireflies (already registered, just verify)
echo ""
echo "--- Step 3: Fireflies MCP ---"
echo "✓ Fireflies MCP already registered (API key in .secrets/)"

# 4. Summary
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Registered MCP servers:"
echo "  • gws              — Gmail, Calendar, Chat, Drive, Tasks, People, Keep"
echo "  • openclaw-gmail-tools — Modify labels, send/delete/read drafts"
echo "  • openclaw-fireflies   — Meeting transcripts, summaries, action items"
echo ""
echo "Still needs separate setup:"
echo "  • Slack     — Get bot token from api.slack.com/apps"
echo "  • Trello    — Get API key from trello.com/app-key"
echo "  • Teams     — Azure app registration at portal.azure.com"
echo "  • MightyCall — API key from Christian"
echo ""
echo "Restart Claude Code to activate all servers."
