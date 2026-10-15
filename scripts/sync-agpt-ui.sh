#!/usr/bin/env bash
# Copies the agpt-ui-* skills from this Mac's ~/.claude/skills into skills/.
# Run from factory-skills/ after you change them locally.
set -euo pipefail
cd "$(dirname "$0")/.."
for dir in "$HOME"/.claude/skills/agpt-ui-*; do
  name=$(basename "$dir")
  rm -rf "skills/$name"
  cp -R "$dir" "skills/$name"
  echo "copied $name"
done
