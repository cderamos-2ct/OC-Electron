#!/usr/bin/env bash
set -euo pipefail

# ─── Verify Vault Migration ──────────────────────────────────────
# Checks that all expected OpenClaw secrets exist in Vaultwarden

BW_APPDATA="$HOME/.openclaw-shell/bw-data"
export BITWARDENCLI_APPDATA_DIR="$BW_APPDATA"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASS=0
FAIL=0

check_secret() {
  local name="$1"
  local description="$2"

  FOUND=$(bw list items --search "$name" 2>/dev/null | python3 -c "
import sys,json
items = json.load(sys.stdin)
for item in items:
  fields = item.get('fields', []) or []
  for f in fields:
    if f.get('name') == 'openclaw-secret-name' and f.get('value') == '$name':
      pwd = (item.get('login') or {}).get('password', '')
      print('FOUND' if pwd else 'EMPTY')
      break
" 2>/dev/null || echo "MISSING")

  if [[ "$FOUND" == "FOUND" ]]; then
    echo -e "  ${GREEN}PASS${NC}  $name — $description"
    ((PASS++)) || true
  elif [[ "$FOUND" == "EMPTY" ]]; then
    echo -e "  ${YELLOW}WARN${NC}  $name — exists but empty value"
    ((PASS++)) || true
  else
    echo -e "  ${RED}FAIL${NC}  $name — $description"
    ((FAIL++)) || true
  fi
}

echo "═══ Vault Migration Verification ═══"
echo ""

bw sync >/dev/null 2>&1

check_secret "openclaw/tokens/telegram-bot" "Telegram bot token"
check_secret "openclaw/api-keys/fireflies" "Fireflies API key"
check_secret "openclaw/api-keys/github-pat" "GitHub personal access token"
check_secret "openclaw/oauth/gcp-client-secret" "GCP OAuth client secret"
check_secret "openclaw/api-keys/expensify" "Expensify partner credentials"
check_secret "openclaw/tokens/gateway" "Gateway token"
check_secret "openclaw/device-auth/tokens" "Device auth tokens"
check_secret "openclaw/device-auth/identity-keypair" "Device identity Ed25519 keypair"

echo ""
echo "════════════════════════════════════════════"
echo -e "  ${GREEN}Passed: $PASS${NC}"
if [[ $FAIL -gt 0 ]]; then
  echo -e "  ${RED}Failed: $FAIL${NC}"
  echo ""
  echo "Re-run scripts/migrate-secrets-to-vault.sh to retry failed migrations."
  exit 1
else
  echo ""
  echo -e "  ${GREEN}All secrets verified!${NC}"
fi
