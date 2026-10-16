#!/usr/bin/env bash
# Preview the GitHub Pages site locally.
# Mirrors the CI assembly in .github/workflows/pages.yml:
#   LP at /his/  (from docs/)  +  demo at /his/demo/  (webui build, mock API)
#
# Usage:
#   scripts/preview.sh [port]      # default port: 8000
#   NO_BUILD=1 scripts/preview.sh  # skip the webui rebuild (LP-only edits)

set -euo pipefail

port="${1:-8000}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${TMPDIR:-/tmp}/his-preview"

if [[ "${NO_BUILD:-}" != "1" ]]; then
  echo "==> building demo (mock API, base /his/demo/)"
  HIS_BASE=/his/demo/ VITE_USE_MOCK_API=true pnpm -C "$root/webui" run build
fi

echo "==> assembling $out"
rm -rf "$out"
mkdir -p "$out/his/demo"
cp -R "$root/docs/." "$out/his/"
cp -R "$root/webui/dist/." "$out/his/demo/"

echo "==> serving http://localhost:$port/his/"
python3 -m http.server "$port" --bind 127.0.0.1 --directory "$out"
