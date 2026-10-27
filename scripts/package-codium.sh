#!/usr/bin/env bash
set -euo pipefail

# Package this fork at upstream-version + 1 patch and install it into Codium.
#
# The version bump happens in a staging copy of HEAD only, so the working tree
# and the committed package.json stay aligned with upstream (rebase-friendly),
# while the installed build outranks the marketplace release it replaces.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  echo "[warn] working tree has uncommitted changes; packaging committed HEAD only" >&2
fi

git -C "$ROOT" archive HEAD | tar -x -C "$STAGE"
git -C "$STAGE" init -q

node - "$STAGE/package.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
if ([major, minor, patch].some(Number.isNaN)) {
  throw new Error('invalid version: ' + pkg.version);
}
pkg.version = `${major}.${minor}.${patch + 1}`;
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
NODE

NEW_VERSION="$(node -p "require('$STAGE/package.json').version")"
VSIX="$ROOT/output/llm-commit-message-$NEW_VERSION.vsix"
mkdir -p "$ROOT/output"
rm -f "$VSIX"

VSCE="$ROOT/node_modules/.bin/vsce"
if [ -x "$VSCE" ]; then
  (cd "$STAGE" && "$VSCE" package --out "$VSIX")
else
  (cd "$STAGE" && npx --yes @vscode/vsce package --out "$VSIX")
fi

EXT_CLI="${EXT_CLI:-codium}"
if ! command -v "$EXT_CLI" >/dev/null 2>&1; then
  echo "[error] $EXT_CLI not found; set EXT_CLI to your editor's CLI" >&2
  exit 1
fi

echo "[install] $VSIX -> $EXT_CLI" >&2
"$EXT_CLI" --install-extension "$VSIX" --force

echo "[done] installed $(basename "$VSIX"); reload the window to activate" >&2
