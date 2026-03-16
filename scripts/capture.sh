#!/bin/bash
# Quick capture — shortcut to Boswell's thought capture
# Usage: ./capture.sh "your thought here"
#        ./capture.sh @marcus "check Q1 numbers" #finance
#        ./capture.sh   (interactive mode)
DIR="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$DIR/apps/runtime/boswell-capture.py" "$@"
