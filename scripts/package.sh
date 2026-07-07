#!/usr/bin/env bash
#
# Builds a clean, store-ready zip of the extension.
#
# It zips ONLY the files the extension needs to run (plus license & privacy),
# and deliberately leaves out development files (tests, store screenshots, this
# script, git data). The same zip works for both the Chrome Web Store and
# Firefox Add-ons (AMO).
#
# Usage:  bash scripts/package.sh
# Output: priority-scorer-<version>.zip  in the project root.

set -euo pipefail

# Run from the project root (the folder that contains manifest.json), regardless
# of where the script is called from.
cd "$(dirname "$0")/.."

# Read the version out of manifest.json so the zip is named to match.
VERSION=$(node -p "require('./manifest.json').version")
OUT="priority-scorer-${VERSION}.zip"

# The exact set of things that ship inside the extension.
INCLUDE=(
  manifest.json
  icons
  lib
  content
  popup
  report
  README.md
  PRIVACY.md
  LICENSE
)

echo "Packaging Priority Scorer v${VERSION}..."
rm -f "$OUT"

# -r recurse, -X strip extra file attributes for a clean cross-platform zip.
zip -r -X "$OUT" "${INCLUDE[@]}" \
  -x '*/.DS_Store' -x '*.map' >/dev/null

echo "Created $OUT"
echo "Contents:"
unzip -l "$OUT" | awk 'NR>3 {print "  " $4}' | sed '/^  $/d'
echo
echo "Upload this file to the Chrome Web Store and to Firefox AMO."
