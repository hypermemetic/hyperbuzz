#!/usr/bin/env bash
# hyperbuzz-owned install script (upstream has no file here — additive, so it
# never conflicts when merging block/buzz mainline).
#
# Builds the branded Hyperbuzz desktop app and installs it into /Applications,
# so a fresh install is one command. The app is branded + auto-connects to
# buzz.menger.sh via desktop/src-tauri/{tauri.conf.json,.cargo/config.toml};
# nothing here needs to pass branding — it rides in the committed build config.
#
# Usage:
#   scripts/install-hyperbuzz.sh            # debug bundle (fast)
#   scripts/install-hyperbuzz.sh --release  # optimized bundle (slow)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Activate the repo toolchain (Rust/Node via hermit) if present.
[ -f ./bin/activate-hermit ] && . ./bin/activate-hermit >/dev/null 2>&1 || true

MODE="--debug"
BUNDLE_DIR="target/debug/bundle/macos"
if [[ "${1:-}" == "--release" ]]; then
  MODE=""
  BUNDLE_DIR="target/release/bundle/macos"
fi

# externalBin sidecars must exist for the bundle. Reuse debug builds if present.
TARGET="$(rustc -vV | sed -n 's|host: ||p')"
mkdir -p desktop/src-tauri/binaries
for bin in buzz-acp buzz-agent buzz-dev-mcp git-credential-nostr buzz; do
  if [ -f "target/debug/${bin}" ]; then
    cp -f "target/debug/${bin}" "desktop/src-tauri/binaries/${bin}-${TARGET}"
    chmod +x "desktop/src-tauri/binaries/${bin}-${TARGET}"
  fi
done

echo "Building Hyperbuzz.app ($([ -n "$MODE" ] && echo debug || echo release))…"
( cd desktop && pnpm exec tauri build $MODE )

APP="$(/usr/bin/find "$BUNDLE_DIR" -maxdepth 1 -name 'Hyperbuzz.app' -print -quit 2>/dev/null || true)"
if [ -z "$APP" ]; then
  echo "error: Hyperbuzz.app not found under $BUNDLE_DIR" >&2
  exit 1
fi

echo "Installing $APP -> /Applications/Hyperbuzz.app"
rm -rf "/Applications/Hyperbuzz.app"
cp -R "$APP" "/Applications/Hyperbuzz.app"
# Unsigned local build — clear quarantine so Gatekeeper lets it open.
xattr -dr com.apple.quarantine "/Applications/Hyperbuzz.app" 2>/dev/null || true
echo "Installed. Launch: open -a Hyperbuzz"
