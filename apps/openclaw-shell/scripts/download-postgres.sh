#!/usr/bin/env bash
# Download PostgreSQL 16 binaries + pgvector for macOS (arm64/x64)
# These get bundled into extraResources by electron-builder

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$APP_DIR/vendor"

PG_VERSION="16.6"
PGVECTOR_VERSION="0.8.0"
ARCH="${1:-$(uname -m)}"

echo "=== Downloading PostgreSQL $PG_VERSION for $ARCH ==="

PG_DIR="$VENDOR_DIR/postgres"
mkdir -p "$PG_DIR/bin" "$PG_DIR/lib" "$PG_DIR/share"

# Check if already downloaded
if [ -f "$PG_DIR/bin/postgres" ]; then
  echo "PostgreSQL binaries already present, skipping download."
  echo "Delete $PG_DIR to force re-download."
  exit 0
fi

# On macOS, we extract from the official Postgres.app distribution
# or use Homebrew-bottled binaries
if [ "$(uname)" = "Darwin" ]; then
  echo "Extracting PostgreSQL from Homebrew bottle..."

  # Use Homebrew to get binaries
  BREW_PG="$(brew --prefix postgresql@16 2>/dev/null || echo "")"

  if [ -z "$BREW_PG" ] || [ ! -d "$BREW_PG" ]; then
    echo "Installing postgresql@16 via Homebrew (needed for binary extraction)..."
    brew install postgresql@16
    BREW_PG="$(brew --prefix postgresql@16)"
  fi

  # Copy required binaries
  BINS="initdb pg_ctl postgres pg_isready createdb createuser psql"
  for bin in $BINS; do
    if [ -f "$BREW_PG/bin/$bin" ]; then
      cp "$BREW_PG/bin/$bin" "$PG_DIR/bin/"
      echo "  Copied $bin"
    else
      echo "  WARNING: $bin not found at $BREW_PG/bin/$bin"
    fi
  done

  # Copy required libraries
  cp -R "$BREW_PG/lib/"*.dylib "$PG_DIR/lib/" 2>/dev/null || true
  cp -R "$BREW_PG/share/postgresql@16/" "$PG_DIR/share/" 2>/dev/null || true

  # pgvector extension
  echo ""
  echo "=== Downloading pgvector $PGVECTOR_VERSION ==="

  BREW_PGVEC="$(brew --prefix pgvector 2>/dev/null || echo "")"
  if [ -z "$BREW_PGVEC" ] || [ ! -d "$BREW_PGVEC" ]; then
    echo "Installing pgvector via Homebrew..."
    brew install pgvector
    BREW_PGVEC="$(brew --prefix pgvector)"
  fi

  # Copy pgvector shared library
  if [ -f "$BREW_PGVEC/lib/vector.so" ]; then
    cp "$BREW_PGVEC/lib/vector.so" "$PG_DIR/lib/"
    echo "  Copied vector.so"
  elif [ -f "$BREW_PGVEC/lib/vector.dylib" ]; then
    cp "$BREW_PGVEC/lib/vector.dylib" "$PG_DIR/lib/vector.so"
    echo "  Copied vector.dylib as vector.so"
  else
    # Try finding it in the Postgres extension dir
    PG_PKGLIB="$BREW_PG/lib/postgresql@16"
    if [ -f "$PG_PKGLIB/vector.so" ]; then
      cp "$PG_PKGLIB/vector.so" "$PG_DIR/lib/"
      echo "  Copied vector.so from pg extension dir"
    else
      echo "  WARNING: pgvector shared library not found"
    fi
  fi

  # Copy pgvector SQL files
  PG_SHAREDIR="$BREW_PG/share/postgresql@16/extension"
  if [ -d "$PG_SHAREDIR" ]; then
    mkdir -p "$PG_DIR/share/extension"
    cp "$PG_SHAREDIR/vector"* "$PG_DIR/share/extension/" 2>/dev/null || true
    echo "  Copied pgvector extension SQL files"
  fi

  # Fix dylib rpaths so binaries work outside Homebrew
  echo ""
  echo "=== Fixing library paths ==="
  for bin in "$PG_DIR/bin/"*; do
    if [ -f "$bin" ]; then
      install_name_tool -add_rpath "@executable_path/../lib" "$bin" 2>/dev/null || true
    fi
  done
  echo "  Done."

else
  echo "ERROR: This script currently supports macOS only."
  echo "Linux/Windows support will be added in Sprint 5."
  exit 1
fi

echo ""
echo "=== PostgreSQL vendor binaries ready ==="
echo "Location: $PG_DIR"
ls -la "$PG_DIR/bin/"
echo ""
ls -la "$PG_DIR/lib/" | head -20
