#!/usr/bin/env bash
# Deploy the PearCup hackathon site to Cloudflare Pages (Direct Upload).
# Prereq: authenticate once with `wrangler login` (or export CLOUDFLARE_API_TOKEN).
# Usage: scripts/deploy-site-cloudflare.sh [project-name]
set -euo pipefail

PROJECT="${1:-pearcup-kawaii}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_DIR="$ROOT/site"

echo "→ Deploying $SITE_DIR to Cloudflare Pages project '$PROJECT'"

# Create the Pages project if it doesn't exist yet (ignore 'already exists').
npx wrangler pages project create "$PROJECT" --production-branch main 2>/dev/null \
  || echo "  (project already exists — reusing)"

# Upload the static site. Prints the deployment URL on success.
npx wrangler pages deploy "$SITE_DIR" \
  --project-name "$PROJECT" \
  --branch main \
  --commit-dirty=true
