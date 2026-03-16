#!/usr/bin/env bash
set -euo pipefail

# ─── Secret Migration to Vaultwarden ─────────────────────────────
# Reads secrets from their current plaintext locations and
# creates Bitwarden items tagged with openclaw-secret-name

VAULT_URL="http://127.0.0.1:8222"
BW_APPDATA="$HOME/.openclaw-shell/bw-data"
OPENCLAW_ROOT="${OPENCLAW_ROOT:-/Volumes/Storage/OpenClaw}"
BACKUP_DIR="$HOME/.openclaw-shell/secret-backup-$(date +%Y%m%d-%H%M%S)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[migrate]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }
info() { echo -e "${BLUE}[info]${NC} $*"; }

export BITWARDENCLI_APPDATA_DIR="$BW_APPDATA"

MIGRATED=0
SKIPPED=0
FAILED=0

# ─── Pre-flight ─────────────────────────────────────────────────

if ! command -v bw &>/dev/null; then
  error "Bitwarden CLI not found. Run scripts/install-vaultwarden.sh first."
  exit 1
fi

STATUS=$(bw status 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "locked")
if [[ "$STATUS" != "unlocked" ]]; then
  error "Vault is not unlocked. Run scripts/setup-vaultwarden.sh first."
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
log "Backup directory: $BACKUP_DIR"

# ─── Helper: Create vault item ──────────────────────────────────

create_secret() {
  local name="$1"
  local value="$2"
  local folder_name="$3"

  # Check if already exists
  EXISTING=$(bw list items --search "$name" 2>/dev/null | python3 -c "
import sys,json
items = json.load(sys.stdin)
for item in items:
  fields = item.get('fields', []) or []
  for f in fields:
    if f.get('name') == 'openclaw-secret-name' and f.get('value') == '$name':
      print('exists')
      break
" 2>/dev/null || echo "")

  if [[ "$EXISTING" == "exists" ]]; then
    warn "  Already exists: $name (skipping)"
    ((SKIPPED++)) || true
    return 0
  fi

  # Get folder ID
  FOLDER_ID=$(bw list folders 2>/dev/null | python3 -c "
import sys,json
folders = json.load(sys.stdin)
for f in folders:
  if f['name'] == '$folder_name':
    print(f['id'])
    break
" 2>/dev/null || echo "")

  # Build item JSON
  ITEM_JSON=$(python3 -c "
import json, sys
item = {
  'type': 1,
  'name': '$name',
  'folderId': '$FOLDER_ID' if '$FOLDER_ID' else None,
  'login': {
    'username': None,
    'password': sys.stdin.read().strip()
  },
  'notes': None,
  'fields': [
    {'name': 'openclaw-secret-name', 'value': '$name', 'type': 0}
  ]
}
print(json.dumps(item))
" <<< "$value")

  ENCODED=$(echo -n "$ITEM_JSON" | base64)

  if bw create item "$ENCODED" >/dev/null 2>&1; then
    log "  Migrated: $name → $folder_name"
    ((MIGRATED++)) || true
  else
    error "  Failed: $name"
    ((FAILED++)) || true
  fi
}

# ─── Migration: Non-critical first ──────────────────────────────

echo ""
info "═══ Phase 1: Legacy / Non-critical ═══"

# Telegram bot token
TELEGRAM_ENV="$OPENCLAW_ROOT/legacy/imported/antigravity-agent/.env"
if [[ -f "$TELEGRAM_ENV" ]]; then
  cp "$TELEGRAM_ENV" "$BACKUP_DIR/telegram.env"
  TOKEN=$(grep -oP 'TELEGRAM_BOT_TOKEN=\K.*' "$TELEGRAM_ENV" 2>/dev/null || grep 'TELEGRAM_BOT_TOKEN=' "$TELEGRAM_ENV" | cut -d= -f2-)
  if [[ -n "$TOKEN" ]]; then
    create_secret "openclaw/tokens/telegram-bot" "$TOKEN" "openclaw/tokens"
  else
    warn "  No Telegram token found in $TELEGRAM_ENV"
  fi
else
  warn "  Telegram .env not found (already cleaned up?)"
fi

# ─── Phase 2: Development secrets ────────────────────────────────

echo ""
info "═══ Phase 2: Development Secrets ═══"

# Fireflies API key
FIREFLIES_FILE="$OPENCLAW_ROOT/.secrets/fireflies_api_key.txt"
if [[ -f "$FIREFLIES_FILE" ]]; then
  cp "$FIREFLIES_FILE" "$BACKUP_DIR/fireflies_api_key.txt"
  FIREFLIES_KEY=$(cat "$FIREFLIES_FILE" | tr -d '[:space:]')
  create_secret "openclaw/api-keys/fireflies" "$FIREFLIES_KEY" "openclaw/api-keys"
else
  warn "  Fireflies API key not found"
fi

# GitHub PAT
GITHUB_CREDS="$HOME/.openclaw-shell/api-credentials.json"
if [[ -f "$GITHUB_CREDS" ]]; then
  cp "$GITHUB_CREDS" "$BACKUP_DIR/api-credentials.json"
  GITHUB_PAT=$(python3 -c "import json; print(json.load(open('$GITHUB_CREDS')).get('github',{}).get('personal_access_token',''))" 2>/dev/null || echo "")
  if [[ -n "$GITHUB_PAT" ]]; then
    create_secret "openclaw/api-keys/github-pat" "$GITHUB_PAT" "openclaw/api-keys"
  else
    warn "  No GitHub PAT found"
  fi
fi

# GCP OAuth client secrets
for SECRET_FILE in "$OPENCLAW_ROOT"/scripts/client_secret_*.json; do
  if [[ -f "$SECRET_FILE" ]]; then
    BASENAME=$(basename "$SECRET_FILE")
    cp "$SECRET_FILE" "$BACKUP_DIR/$BASENAME"
    SECRET_CONTENT=$(cat "$SECRET_FILE")
    create_secret "openclaw/oauth/gcp-client-secret" "$SECRET_CONTENT" "openclaw/oauth"
    break  # Only need one — they're duplicates
  fi
done

# ─── Phase 3: Finance secrets ────────────────────────────────────

echo ""
info "═══ Phase 3: Finance Secrets ═══"

FINANCE_ENV="$OPENCLAW_ROOT/Finance/.env"
if [[ -f "$FINANCE_ENV" ]]; then
  cp "$FINANCE_ENV" "$BACKUP_DIR/finance.env"

  EXP_USER=$(grep 'PARTNER_USER_ID=' "$FINANCE_ENV" | cut -d= -f2- | tr -d '[:space:]')
  EXP_SECRET=$(grep 'PARTNER_USER_SECRET=' "$FINANCE_ENV" | cut -d= -f2- | tr -d '[:space:]')

  if [[ -n "$EXP_USER" && -n "$EXP_SECRET" ]]; then
    COMBINED="${EXP_USER}:${EXP_SECRET}"
    create_secret "openclaw/api-keys/expensify" "$COMBINED" "openclaw/api-keys"
  else
    warn "  Expensify credentials incomplete"
  fi
else
  warn "  Finance .env not found"
fi

# ─── Phase 4: Device auth (most sensitive) ──────────────────────

echo ""
info "═══ Phase 4: Device Auth ═══"

# Gateway token
DASHBOARD_ENV="$OPENCLAW_ROOT/dashboard/.env.local"
if [[ -f "$DASHBOARD_ENV" ]]; then
  cp "$DASHBOARD_ENV" "$BACKUP_DIR/dashboard.env.local"
  GW_TOKEN=$(grep 'NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN=' "$DASHBOARD_ENV" | cut -d= -f2- | tr -d '[:space:]')
  if [[ -n "$GW_TOKEN" ]]; then
    create_secret "openclaw/tokens/gateway" "$GW_TOKEN" "openclaw/tokens"
  fi
fi

# Device auth tokens
DEVICE_AUTH="$HOME/.openclaw-shell/device-auth.json"
if [[ -f "$DEVICE_AUTH" ]]; then
  cp "$DEVICE_AUTH" "$BACKUP_DIR/device-auth.json"
  DEVICE_AUTH_CONTENT=$(cat "$DEVICE_AUTH")
  create_secret "openclaw/device-auth/tokens" "$DEVICE_AUTH_CONTENT" "openclaw/device-auth"
fi

# Device identity keypair
DEVICE_IDENTITY="$HOME/.openclaw-shell/device-identity.json"
if [[ -f "$DEVICE_IDENTITY" ]]; then
  cp "$DEVICE_IDENTITY" "$BACKUP_DIR/device-identity.json"
  IDENTITY_CONTENT=$(cat "$DEVICE_IDENTITY")
  create_secret "openclaw/device-auth/identity-keypair" "$IDENTITY_CONTENT" "openclaw/device-auth"
fi

# ─── Sync ────────────────────────────────────────────────────────

bw sync >/dev/null 2>&1

# ─── Summary ─────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════"
log "Migration complete!"
log "  Migrated: $MIGRATED"
log "  Skipped:  $SKIPPED (already existed)"
if [[ $FAILED -gt 0 ]]; then
  error "  Failed:   $FAILED"
fi
log "  Backups:  $BACKUP_DIR"
echo ""
log "Next: Run scripts/verify-vault-migration.sh to verify all secrets."
log "Then: Run scripts/cleanup-plaintext-secrets.sh to remove plaintext originals."
