#!/usr/bin/env bash
set -euo pipefail

# ─── Vaultwarden Installation Script ─────────────────────────────
# Installs Vaultwarden as a native launchd service on macOS
# Backed by centralized Postgres (no Docker, no SQLite)

VAULT_PORT=8222
VAULT_DATA_DIR="$HOME/.openclaw-shell/vaultwarden-data"
VAULT_BIN_DIR="$HOME/.local/bin"
VAULT_BIN="$VAULT_BIN_DIR/vaultwarden"
PLIST_NAME="com.openclaw.vaultwarden"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[install]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }

# ─── Pre-flight checks ──────────────────────────────────────────

if [[ "$(uname)" != "Darwin" ]]; then
  error "This script is designed for macOS only."
  exit 1
fi

# Check for Postgres
if ! command -v psql &>/dev/null; then
  error "PostgreSQL client (psql) not found. Install via: brew install postgresql@16"
  exit 1
fi

# ─── Database URL ────────────────────────────────────────────────

if [[ -z "${DATABASE_URL:-}" ]]; then
  # Default to local Postgres with openclaw database
  DATABASE_URL="postgresql://localhost/openclaw_vault"
  warn "DATABASE_URL not set, defaulting to: $DATABASE_URL"
  warn "Create the database first: createdb openclaw_vault"
fi

# ─── Install Vaultwarden ────────────────────────────────────────

mkdir -p "$VAULT_BIN_DIR" "$VAULT_DATA_DIR"

if [[ -f "$VAULT_BIN" ]]; then
  log "Vaultwarden binary already exists at $VAULT_BIN"
  log "Version: $("$VAULT_BIN" --version 2>/dev/null || echo 'unknown')"
else
  log "Installing Vaultwarden..."

  if command -v cargo &>/dev/null; then
    log "Building from source via cargo (this may take a few minutes)..."
    # Vaultwarden requires the postgresql feature for Postgres backend
    cargo install vaultwarden --features postgresql --root "$HOME/.local"
  else
    error "Rust/cargo not found. Install via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    error "Then re-run this script."
    exit 1
  fi
fi

# ─── Install Bitwarden CLI ──────────────────────────────────────

if ! command -v bw &>/dev/null; then
  log "Installing Bitwarden CLI..."
  if command -v npm &>/dev/null; then
    npm install -g @bitwarden/cli
  elif command -v brew &>/dev/null; then
    brew install bitwarden-cli
  else
    error "Cannot install bw CLI — need npm or brew"
    exit 1
  fi
fi
log "Bitwarden CLI: $(bw --version)"

# ─── Download Web Vault (UI) ────────────────────────────────────

WEB_VAULT_DIR="$VAULT_DATA_DIR/web-vault"
if [[ ! -d "$WEB_VAULT_DIR" ]]; then
  log "Downloading Vaultwarden web vault..."
  VAULT_VERSION="v2024.6.2b"
  VAULT_URL="https://github.com/dani-garcia/bw_web_builds/releases/download/${VAULT_VERSION}/bw_web_${VAULT_VERSION}.tar.gz"

  curl -sL "$VAULT_URL" | tar -xz -C "$VAULT_DATA_DIR"
  log "Web vault extracted to $WEB_VAULT_DIR"
else
  log "Web vault already exists at $WEB_VAULT_DIR"
fi

# ─── Create launchd plist ───────────────────────────────────────

log "Creating launchd service at $PLIST_PATH"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${VAULT_BIN}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>DATABASE_URL</key>
    <string>${DATABASE_URL}</string>
    <key>ROCKET_PORT</key>
    <string>${VAULT_PORT}</string>
    <key>DATA_FOLDER</key>
    <string>${VAULT_DATA_DIR}</string>
    <key>WEB_VAULT_ENABLED</key>
    <string>true</string>
    <key>WEB_VAULT_FOLDER</key>
    <string>${WEB_VAULT_DIR}</string>
    <key>SIGNUPS_ALLOWED</key>
    <string>false</string>
    <key>ADMIN_TOKEN</key>
    <string></string>
    <key>LOG_FILE</key>
    <string>${VAULT_DATA_DIR}/vaultwarden.log</string>
    <key>ROCKET_ADDRESS</key>
    <string>127.0.0.1</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${VAULT_DATA_DIR}/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${VAULT_DATA_DIR}/stderr.log</string>
</dict>
</plist>
EOF

# ─── Start service ──────────────────────────────────────────────

log "Loading launchd service..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

# Wait for startup
sleep 2

if curl -sf "http://127.0.0.1:${VAULT_PORT}/alive" >/dev/null 2>&1; then
  log "Vaultwarden is running on port ${VAULT_PORT}"
  log "Admin panel: http://127.0.0.1:${VAULT_PORT}/admin"
else
  warn "Vaultwarden may still be starting up. Check logs: tail -f ${VAULT_DATA_DIR}/stderr.log"
fi

echo ""
log "Installation complete!"
log ""
log "Next steps:"
log "  1. Open http://127.0.0.1:${VAULT_PORT} to create your admin account"
log "  2. Run: scripts/setup-vaultwarden.sh  to configure bw CLI and create folders"
log "  3. Run: scripts/migrate-secrets-to-vault.sh  to migrate existing secrets"
