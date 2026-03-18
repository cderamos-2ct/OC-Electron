#!/usr/bin/env bash
# Download all vendor binaries for Aegilume self-contained packaging
# Run this before `electron-builder` to populate vendor/ directory

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$APP_DIR/vendor"

echo "=== Aegilume Vendor Binary Downloader ==="
echo "Target: $VENDOR_DIR"
echo ""

# ── 1. PostgreSQL + pgvector ──────────────────────────────────────────────
bash "$SCRIPT_DIR/download-postgres.sh"

# ── 2. Vaultwarden ───────────────────────────────────────────────────────
VW_DIR="$VENDOR_DIR/vaultwarden"
VW_VERSION="1.32.7"
mkdir -p "$VW_DIR"

if [ -f "$VW_DIR/vaultwarden" ]; then
  echo "Vaultwarden already present, skipping."
else
  echo ""
  echo "=== Downloading Vaultwarden $VW_VERSION ==="
  ARCH="$(uname -m)"
  if [ "$ARCH" = "arm64" ]; then
    VW_ARCH="aarch64"
  else
    VW_ARCH="x86_64"
  fi

  VW_URL="https://github.com/dani-garcia/vaultwarden/releases/download/${VW_VERSION}/vaultwarden-${VW_VERSION}-${VW_ARCH}-apple-darwin.tar.gz"
  echo "Downloading from: $VW_URL"

  curl -fsSL "$VW_URL" -o "$VW_DIR/vaultwarden.tar.gz" || {
    echo "WARNING: Vaultwarden download failed. You may need to build from source."
    echo "See: https://github.com/dani-garcia/vaultwarden/wiki/Building-binary"
  }

  if [ -f "$VW_DIR/vaultwarden.tar.gz" ]; then
    tar xzf "$VW_DIR/vaultwarden.tar.gz" -C "$VW_DIR/"
    rm -f "$VW_DIR/vaultwarden.tar.gz"
    chmod +x "$VW_DIR/vaultwarden"
    echo "  Vaultwarden extracted."
  fi
fi

# ── 3. Bitwarden CLI ────────────────────────────────────────────────────
BW_DIR="$VENDOR_DIR/bw"
BW_VERSION="2025.1.0"
mkdir -p "$BW_DIR"

if [ -f "$BW_DIR/bw" ]; then
  echo "Bitwarden CLI already present, skipping."
else
  echo ""
  echo "=== Downloading Bitwarden CLI $BW_VERSION ==="

  BW_URL="https://github.com/bitwarden/clients/releases/download/cli-v${BW_VERSION}/bw-macos-${BW_VERSION}.zip"
  echo "Downloading from: $BW_URL"

  curl -fsSL "$BW_URL" -o "$BW_DIR/bw.zip" || {
    echo "WARNING: Bitwarden CLI download failed."
    echo "Install manually: npm install -g @bitwarden/cli"
  }

  if [ -f "$BW_DIR/bw.zip" ]; then
    unzip -qo "$BW_DIR/bw.zip" -d "$BW_DIR/"
    rm -f "$BW_DIR/bw.zip"
    chmod +x "$BW_DIR/bw"
    echo "  Bitwarden CLI extracted."
  fi
fi

# ── 4. GWS CLI ──────────────────────────────────────────────────────────
GWS_DIR="$VENDOR_DIR/gws"
mkdir -p "$GWS_DIR"

if [ -f "$GWS_DIR/gws" ]; then
  echo "GWS CLI already present, skipping."
else
  echo ""
  echo "=== Extracting GWS CLI from node_modules ==="

  # GWS is an npm package — extract the binary from node_modules
  GWS_BIN="$APP_DIR/node_modules/.bin/gws"
  if [ -f "$GWS_BIN" ]; then
    # Resolve the actual binary (may be a symlink)
    GWS_REAL="$(readlink -f "$GWS_BIN" 2>/dev/null || realpath "$GWS_BIN" 2>/dev/null || echo "$GWS_BIN")"
    cp "$GWS_REAL" "$GWS_DIR/gws"
    chmod +x "$GWS_DIR/gws"
    echo "  GWS CLI extracted from node_modules."
  else
    echo "WARNING: GWS CLI not found in node_modules."
    echo "Run: npm install @googleworkspace/cli"
  fi
fi

# ── 5. code-server ──────────────────────────────────────────────────────
CS_DIR="$VENDOR_DIR/code-server"
CS_VERSION="4.111.0"
mkdir -p "$CS_DIR"

if [ -f "$CS_DIR/bin/code-server" ]; then
  echo "code-server already present, skipping."
else
  echo ""
  echo "=== Downloading code-server $CS_VERSION ==="

  PLATFORM="darwin"
  ARCH="$(uname -m)"
  if [ "$ARCH" = "arm64" ]; then
    CS_ARCH="arm64"
  else
    CS_ARCH="amd64"
  fi

  CS_TARBALL="code-server-${CS_VERSION}-macos-${CS_ARCH}.tar.gz"
  CS_URL="https://github.com/coder/code-server/releases/download/v${CS_VERSION}/${CS_TARBALL}"
  echo "Downloading from: $CS_URL"

  curl -fsSL "$CS_URL" -o "$CS_DIR/${CS_TARBALL}" || {
    echo "WARNING: code-server download failed."
    echo "Download manually from: https://github.com/coder/code-server/releases"
  }

  if [ -f "$CS_DIR/${CS_TARBALL}" ]; then
    tar xzf "$CS_DIR/${CS_TARBALL}" -C "$CS_DIR/" --strip-components=1
    rm -f "$CS_DIR/${CS_TARBALL}"
    echo "  code-server extracted."
  fi
fi

echo ""
echo "=== Vendor binaries summary ==="
echo ""
for dir in postgres vaultwarden bw gws code-server; do
  if [ -d "$VENDOR_DIR/$dir" ]; then
    SIZE=$(du -sh "$VENDOR_DIR/$dir" 2>/dev/null | cut -f1)
    echo "  $dir: $SIZE"
  else
    echo "  $dir: MISSING"
  fi
done
echo ""
echo "Total vendor size: $(du -sh "$VENDOR_DIR" 2>/dev/null | cut -f1)"
echo ""
echo "Ready to build: npx electron-builder --mac"
