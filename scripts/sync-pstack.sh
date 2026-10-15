#!/usr/bin/env bash
# Refreshes pstack/ from cursor/plugins (MIT, Lauren Tan). Run from factory-skills/.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git clone --depth 1 --filter=blob:none --sparse https://github.com/cursor/plugins.git "$tmp/plugins"
git -C "$tmp/plugins" sparse-checkout set pstack
rm -rf pstack
mkdir -p pstack
cp -R "$tmp/plugins/pstack/skills" pstack/skills
cp "$tmp/plugins/pstack/LICENSE" pstack/LICENSE
cp "$tmp/plugins/pstack/README.md" pstack/README.md 2>/dev/null || true
git -C "$tmp/plugins" rev-parse HEAD > pstack/UPSTREAM_COMMIT
echo "pstack synced at $(cat pstack/UPSTREAM_COMMIT)"
