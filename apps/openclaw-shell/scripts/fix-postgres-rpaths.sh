#!/usr/bin/env bash
# Fix Postgres binary rpaths for self-contained packaging
# Copies Homebrew dylibs into vendor/postgres/lib and rewrites load paths
# to use @loader_path/../lib so binaries work outside of Homebrew.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
PG_BIN="$APP_DIR/vendor/postgres/bin"
PG_LIB="$APP_DIR/vendor/postgres/lib"

echo "=== Fixing Postgres rpaths ==="
echo "Binaries: $PG_BIN"
echo "Libraries: $PG_LIB"
echo ""

# Collect all non-system dylib dependencies from all binaries
DEPS=""
for bin in "$PG_BIN"/*; do
  [ -f "$bin" ] || continue
  DEPS="$DEPS
$(otool -L "$bin" | grep "/opt/homebrew" | awk '{print $1}')"
done

# Deduplicate
DEPS=$(echo "$DEPS" | sort -u | grep -v '^$')

echo "Homebrew dependencies to bundle:"
echo "$DEPS"
echo ""

# Also check transitive deps of the libs we're about to copy
TRANS_DEPS=""
for dep in $DEPS; do
  if [ -f "$dep" ]; then
    TRANS_DEPS="$TRANS_DEPS
$(otool -L "$dep" | grep "/opt/homebrew" | awk '{print $1}')"
  fi
done
TRANS_DEPS=$(echo "$TRANS_DEPS" | sort -u | grep -v '^$')

# Merge all deps
ALL_DEPS=$(echo -e "$DEPS\n$TRANS_DEPS" | sort -u | grep -v '^$')

echo "All dependencies (including transitive):"
echo "$ALL_DEPS"
echo ""

# Copy each dylib into vendor/postgres/lib
for dep in $ALL_DEPS; do
  if [ -f "$dep" ]; then
    base=$(basename "$dep")
    if [ ! -f "$PG_LIB/$base" ]; then
      cp "$dep" "$PG_LIB/$base"
      chmod 755 "$PG_LIB/$base"
      echo "  Copied: $base"
    else
      echo "  Already exists: $base"
    fi
  else
    echo "  WARNING: $dep not found"
  fi
done

echo ""
echo "Rewriting load paths in binaries..."

# Rewrite load paths in all binaries
for bin in "$PG_BIN"/*; do
  [ -f "$bin" ] || continue
  name=$(basename "$bin")

  # Get all homebrew deps for this binary
  bin_deps=$(otool -L "$bin" | grep "/opt/homebrew" | awk '{print $1}')
  for dep in $bin_deps; do
    base=$(basename "$dep")
    install_name_tool -change "$dep" "@loader_path/../lib/$base" "$bin" 2>/dev/null || true
  done

  # Add rpath if not present
  install_name_tool -add_rpath "@loader_path/../lib" "$bin" 2>/dev/null || true

  echo "  Fixed: $name"
done

echo ""
echo "Rewriting load paths in bundled dylibs..."

# Fix dylibs' own dependencies on each other
for lib in "$PG_LIB"/*.dylib; do
  [ -f "$lib" ] || continue
  name=$(basename "$lib")

  # Fix install name
  install_name_tool -id "@loader_path/$name" "$lib" 2>/dev/null || true

  # Fix deps
  lib_deps=$(otool -L "$lib" | grep "/opt/homebrew" | awk '{print $1}')
  for dep in $lib_deps; do
    base=$(basename "$dep")
    install_name_tool -change "$dep" "@loader_path/$base" "$lib" 2>/dev/null || true
  done
done

echo ""
echo "Verifying — no Homebrew references should remain:"
REMAINING=0
for bin in "$PG_BIN"/*; do
  [ -f "$bin" ] || continue
  if otool -L "$bin" | grep -q "/opt/homebrew"; then
    echo "  STILL HAS HOMEBREW REFS: $(basename "$bin")"
    REMAINING=$((REMAINING + 1))
  fi
done
for lib in "$PG_LIB"/*.dylib; do
  [ -f "$lib" ] || continue
  if otool -L "$lib" | grep -q "/opt/homebrew"; then
    echo "  STILL HAS HOMEBREW REFS: $(basename "$lib")"
    REMAINING=$((REMAINING + 1))
  fi
done

if [ "$REMAINING" -eq 0 ]; then
  echo "  All clean — no Homebrew references remain."
else
  echo "  WARNING: $REMAINING files still reference Homebrew."
fi

echo ""
echo "=== Postgres rpath fix complete ==="
