#!/usr/bin/env bash
# Deploy the PearCup hackathon site to Cloudflare Pages (Direct Upload).
# Prereq: authenticate once with `wrangler login` (or export CLOUDFLARE_API_TOKEN).
# Usage: scripts/deploy-site-cloudflare.sh [project-name]
set -euo pipefail

PROJECT="${1:-pearcup-kawaii}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT/cloudflare/pages-dist"

if [[ ! -f "$DIST_DIR/index.html" || ! -f "$DIST_DIR/play/index.html" ]]; then
  echo "→ Building the combined marketing + browser game artifact"
  (cd "$ROOT" && npm run build:cloudflare-pages)
fi

echo "→ Deploying $DIST_DIR to Cloudflare Pages project '$PROJECT'"

# Always rebuild from the production-safe public settings before uploading.
# Without this, a previously generated Pages artifact can retain a null
# content-addressed settings file and silently fall back to bundled fixtures.
export PEARCUP_IDENTITY_API_URL="${PEARCUP_IDENTITY_API_URL:-https://pearcup-kawaii-identity.throbbing-limit-1abb.workers.dev}"
export PEARCUP_HIVERELAY_URL="${PEARCUP_HIVERELAY_URL:-https://relay-sg.p2phiverelay.xyz}"
export PEARCUP_LIVE_DATA_RELAY_URL="${PEARCUP_LIVE_DATA_RELAY_URL:-https://pearcup-live-data.throbbing-limit-1abb.workers.dev/v1/live-match.json}"
# Never let an offline/local override leak into a production Pages upload.
unset PEARCUP_ALLOW_EMPTY_PUBLIC_SETTINGS
(cd "$ROOT" && npm run build:cloudflare-pages && npm run check:cloudflare-pages)

# Create the Pages project if it doesn't exist yet (ignore 'already exists').
npx wrangler pages project create "$PROJECT" --production-branch main 2>/dev/null \
  || echo "  (project already exists — reusing)"

# Upload the static site. Prints the deployment URL on success.
npx wrangler pages deploy "$DIST_DIR" \
  --project-name "$PROJECT" \
  --branch main \
  --commit-dirty=true
