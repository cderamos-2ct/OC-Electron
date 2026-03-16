#!/usr/bin/env bash
set -euo pipefail

# ─── Vaultwarden First-Run Setup ─────────────────────────────────
# Configures bw CLI to connect to local Vaultwarden instance
# Creates OpenClaw folder structure and verifies connectivity

VAULT_URL="http://127.0.0.1:8222"
BW_APPDATA="$HOME/.openclaw-shell/bw-data"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }

export BITWARDENCLI_APPDATA_DIR="$BW_APPDATA"
mkdir -p "$BW_APPDATA"

# ─── Pre-flight ─────────────────────────────────────────────────

if ! command -v bw &>/dev/null; then
  error "Bitwarden CLI not found. Run scripts/install-vaultwarden.sh first."
  exit 1
fi

# Check server is running
if ! curl -sf "${VAULT_URL}/alive" >/dev/null 2>&1; then
  error "Vaultwarden is not running at ${VAULT_URL}"
  error "Start it with: launchctl load ~/Library/LaunchAgents/com.openclaw.vaultwarden.plist"
  exit 1
fi

log "Vaultwarden is running at ${VAULT_URL}"

# ─── Configure CLI ──────────────────────────────────────────────

log "Configuring bw CLI to use local Vaultwarden..."
bw config server "$VAULT_URL"

# ─── Login / Unlock ─────────────────────────────────────────────

STATUS=$(bw status 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unauthenticated")

if [[ "$STATUS" == "unauthenticated" ]]; then
  log "Please log in to Vaultwarden:"
  echo -n "  Email: "
  read -r EMAIL
  echo -n "  Master password: "
  read -rs PASSWORD
  echo ""

  SESSION=$(bw login "$EMAIL" "$PASSWORD" --raw 2>/dev/null || true)

  if [[ -z "$SESSION" ]]; then
    error "Login failed. Check your credentials."
    exit 1
  fi

  export BW_SESSION="$SESSION"
  log "Logged in successfully."
elif [[ "$STATUS" == "locked" ]]; then
  log "Vault is locked. Please enter your master password:"
  echo -n "  Master password: "
  read -rs PASSWORD
  echo ""

  SESSION=$(bw unlock "$PASSWORD" --raw 2>/dev/null || true)

  if [[ -z "$SESSION" ]]; then
    error "Unlock failed. Check your password."
    exit 1
  fi

  export BW_SESSION="$SESSION"
  log "Vault unlocked."
else
  log "Already authenticated (status: $STATUS)"
  # Try to unlock if needed
  if [[ "$STATUS" != "unlocked" ]]; then
    echo -n "  Master password: "
    read -rs PASSWORD
    echo ""
    SESSION=$(bw unlock "$PASSWORD" --raw 2>/dev/null || true)
    export BW_SESSION="$SESSION"
  fi
fi

# ─── Sync ────────────────────────────────────────────────────────

log "Syncing vault..."
bw sync

# ─── Create Folder Structure ────────────────────────────────────

FOLDERS=("openclaw/api-keys" "openclaw/oauth" "openclaw/tokens" "openclaw/device-auth")

log "Creating OpenClaw folder structure..."
EXISTING_FOLDERS=$(bw list folders | python3 -c "import sys,json; [print(f['name']) for f in json.load(sys.stdin)]" 2>/dev/null || echo "")

for FOLDER in "${FOLDERS[@]}"; do
  if echo "$EXISTING_FOLDERS" | grep -qF "$FOLDER"; then
    log "  Folder exists: $FOLDER"
  else
    ENCODED=$(echo -n "{\"name\":\"$FOLDER\"}" | base64)
    bw create folder "$ENCODED" >/dev/null
    log "  Created folder: $FOLDER"
  fi
done

# ─── Verify ─────────────────────────────────────────────────────

log ""
log "Verification:"
FOLDER_COUNT=$(bw list folders | python3 -c "import sys,json; print(len([f for f in json.load(sys.stdin) if f['name'].startswith('openclaw/')]))" 2>/dev/null || echo "?")
ITEM_COUNT=$(bw list items | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")

log "  Folders: $FOLDER_COUNT openclaw folders"
log "  Items: $ITEM_COUNT total items"
log "  Server: $VAULT_URL"
log "  Status: $(bw status 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo 'unknown')"

echo ""
log "Setup complete!"
log ""
log "Next: Run scripts/migrate-secrets-to-vault.sh to migrate existing secrets."
