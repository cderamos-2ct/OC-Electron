#!/usr/bin/env bash
# Build the Next.js dashboard for Electron packaging (standalone mode)
# Run this before `electron-builder` to populate dashboard/.next/standalone/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
DASHBOARD_DIR="$APP_DIR/../../dashboard"

echo "=== Building Dashboard (standalone) ==="
echo "Dashboard: $DASHBOARD_DIR"
echo ""

cd "$DASHBOARD_DIR"

# 1. Build Next.js in standalone mode (requires output: 'standalone' in next.config.ts)
echo "Running next build..."
npx next build

# Next.js standalone puts workspace content at standalone/<workspace-name>/
STANDALONE="$DASHBOARD_DIR/.next/standalone/dashboard"

if [ ! -f "$STANDALONE/server.js" ]; then
  echo "ERROR: standalone/dashboard/server.js not created."
  echo "Ensure next.config.ts has output: 'standalone'"
  exit 1
fi

# 2. Copy the proxy wrapper server into standalone workspace dir
echo "Copying server.cjs into standalone..."
cp "$DASHBOARD_DIR/server.cjs" "$STANDALONE/server.cjs"

# 3. Copy .next/static/ (Next.js standalone doesn't include static chunks)
echo "Copying static chunks..."
mkdir -p "$STANDALONE/.next/static"
cp -r "$DASHBOARD_DIR/.next/static/." "$STANDALONE/.next/static/"

# 4. Copy public/ if not already present
if [ ! -d "$STANDALONE/public" ] && [ -d "$DASHBOARD_DIR/public" ]; then
  echo "Copying public assets..."
  cp -r "$DASHBOARD_DIR/public" "$STANDALONE/public"
fi

# 5. Install http-proxy (needed by server.cjs, not bundled by Next.js)
echo "Installing http-proxy in standalone..."
cd "$STANDALONE"
npm install --no-save http-proxy 2>/dev/null

# 6. Dereference symlinks (electron-builder fails with EISDIR on symlinks)
echo "Dereferencing symlinks in standalone..."
find "$DASHBOARD_DIR/.next/standalone" -type l | while read link; do
  target=$(realpath "$link" 2>/dev/null)
  if [ -d "$target" ]; then
    rm "$link" && cp -r "$target" "$link"
  elif [ -f "$target" ]; then
    rm "$link" && cp "$target" "$link"
  else
    rm "$link"
  fi
done
echo "  Symlinks resolved."

echo ""
echo "=== Dashboard build complete ==="
echo "Standalone dir: $STANDALONE"
echo "Size: $(du -sh "$STANDALONE" 2>/dev/null | cut -f1)"
echo ""
echo "Test with: cd $STANDALONE && HOSTNAME=127.0.0.1 node server.cjs"
