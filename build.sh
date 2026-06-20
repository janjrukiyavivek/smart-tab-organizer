#!/usr/bin/env bash
# build.sh — Packages the extension for Chrome Web Store submission.
# Usage:  bash build.sh
# Output: smart-tab-organizer.zip (ready to upload to the Dev Console)

set -euo pipefail

DIST="smart-tab-organizer.zip"

# Remove any previous build
rm -f "$DIST"

# Files and folders to include (everything the extension needs at runtime)
zip "$DIST" \
  manifest.json \
  background.js \
  popup.html \
  popup.js \
  options.html \
  options.js \
  icons/icon16.png \
  icons/icon48.png \
  icons/icon128.png

echo ""
echo "✓ Built: $DIST"
echo ""
unzip -l "$DIST"
