#!/bin/bash
# Build TockDocs for Vercel with local prerendering and deploy prebuilt.
# Usage: ./scripts/deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
DOCS_DIR="$PROJECT_DIR/docs"

# Load .env files for local environment variables (except NUXT_SITE_URL)
for env_file in "$PROJECT_DIR/.env" "$PROJECT_DIR/.env.local"; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck source=/dev/null
    source <(grep -v '^NUXT_SITE_URL=' "$env_file")
    set +a
  fi
done

# Always use the production site URL for Vercel deploys.
# If NUXT_SITE_URL is still set from env (some other source), respect it.
if [[ -z "${NUXT_SITE_URL:-}" ]] || [[ "$NUXT_SITE_URL" == "http://127.0.0.1:"* ]]; then
  export NUXT_SITE_URL="https://tockdocs.vercel.app"
fi

echo "==> Cleaning stale caches to ensure fresh build..."
rm -rf "$DOCS_DIR/.data/content"
rm -rf "$DOCS_DIR/.nuxt"
rm -rf "$DOCS_DIR/.vercel"
rm -rf "$DOCS_DIR/.output"
rm -rf "$PROJECT_DIR/node_modules/.cache/nuxt"
echo "    Caches cleaned."

echo ""
echo "==> Building TockDocs for Vercel (NITRO_PRESET=vercel, NUXT_SITE_URL=$NUXT_SITE_URL)..."
cd "$DOCS_DIR"
NUXT_SITE_URL="$NUXT_SITE_URL" NITRO_PRESET=vercel NODE_OPTIONS=--max-old-space-size=6144 npx nuxt build

echo ""
echo "==> Validating build output..."
SERVER_MJS="$DOCS_DIR/.vercel/output/functions/__fallback.func/chunks/build/server.mjs"
if ! grep -q "entry_default as default" "$SERVER_MJS" 2>/dev/null; then
  echo "ERROR: server.mjs is missing the production SSR entry (entry_default as default)."
  echo "The build may have produced a development-mode server bundle."
  echo "Check that NITRO_PRESET=vercel is set and no dev server is running on port 4987."
  exit 1
fi
if grep -q "vite-node-entry" "$SERVER_MJS" 2>/dev/null; then
  echo "ERROR: server.mjs imports vite-node-entry.mjs (development wrapper)."
  echo "This indicates the production build did not inline the server entry."
  exit 1
fi
echo "    Build output validated."

echo ""
echo "==> Copying build output to repo root (rootDirectory=docs quirk)..."
cd "$PROJECT_DIR"
rm -rf .vercel/output
cp -r "$DOCS_DIR/.vercel/output" .vercel/output

echo ""
echo "==> Deploying prebuilt to Vercel production..."
vercel deploy --prebuilt --prod --yes

echo ""
echo "==> Deploy complete."
echo "    Production URL: https://tockdocs.vercel.app"
echo "    Inspect: vercel list --scope tao-project"
