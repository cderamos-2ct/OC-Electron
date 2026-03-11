#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec python3 -W ignore "${SCRIPT_DIR}/filesystem_helper.py" "$@"
