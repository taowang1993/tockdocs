---
name: deploy
description: Deploy TockDocs to Vercel using local build + prebuilt artifacts. Use when the user wants to deploy to Vercel faster than the default cloud build, or when troubleshooting Vercel deployments. The project is configured at tao-project/tockdocs with rootDirectory=docs and uses the Nuxt framework preset. The deploy script is bundled at scripts/deploy.sh.
---

## Quick deploy

The deploy script **rebuilds** the project locally (`nuxt build`) before uploading prebuilt artifacts to Vercel. No remote build is triggered.

Before building, the script cleans stale caches to prevent Nuxt Content from serving outdated prerendered pages:
- `docs/.data/content` — Nuxt Content SQLite database
- `docs/.nuxt` — Nuxt build cache
- `docs/.vercel` — previous build output
- `node_modules/.cache/nuxt` — module cache

```bash
cd ~/projects/knowledge/tockdocs
./.agents/skills/vercel-deploy/scripts/deploy.sh
```

## Architecture

```
Local build                          Vercel (prebuilt)
┌─────────────────────┐             ┌──────────────────────────┐
│ nuxt build           │             │ .vercel/output/           │
│ (NITRO_PRESET=vercel)│  vercel     │   static/  (HTML/JS/CSS)  │
│   ↓                  │  deploy     │   functions/__fallback/   │
│ docs/.vercel/output/ │ ─────────→  │   config.json             │
│   ↓                  │  --prebuilt │                            │
│ cp to repo root      │             │ Vercel processes (42s)     │
│ .vercel/output/      │             │ then serves via CDN + λ    │
└─────────────────────┘             └──────────────────────────┘
```

Key constraint:
- **rootDirectory is `docs`**, so `.vercel/project.json` lives at the repo root, but Nuxt writes `.vercel/output/` inside `docs/`. The deploy script copies `docs/.vercel/output/` → `.vercel/output/` before deploying.

## Preventing remote rebuilds

When you deploy via `vercel deploy --prebuilt`, Vercel does **not** re-run the build — it processes the prebuilt artifacts directly. However, if the project has a Git integration connected, pushing to GitHub will trigger a **separate** cloud build deployment.

### Option A: Disconnect Git (recommended for CLI-only)

Go to https://vercel.com/tao-project/tockdocs/settings/git and disconnect the repository. All deployments then happen exclusively via CLI.

### Option B: Ignored Build Step for production

Keep Git connected for preview deployments, but skip production builds. Add to the project's Build & Development Settings (or `vercel.json`):

```json
{
  "ignoreCommand": "node -e \"process.exit(process.env.VERCEL_ENV === 'production' ? 0 : 1)\""
}
```

This tells Vercel to skip the build (exit 0) when the target is production. Preview deployments still build normally. To force a production build from Git, add `[vercel build]` to the commit message and update the ignoreCommand to check for it.

## Project details

| Setting | Value |
|---|---|
| Project | `tao-project/tockdocs` |
| Root Directory | `docs` |
| Framework | Nuxt |
| Node.js | 24.x |
| Production URL | `https://tockdocs.vercel.app` |

## Environment variables

Set at https://vercel.com/tao-project/tockdocs/settings/environment-variables. Must-have:

| Variable | Purpose |
|---|---|
| `NUXT_SITE_URL` | Canonical site URL (no trailing slash) |
| `AI_PROVIDER` | AI provider for assistant |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `DEEPSEEK_MODEL` | DeepSeek model name |
| `NUXT_PUBLIC_ASSISTANT_ENABLED` | Enable AI assistant |

## Timing expectations

| Step | Time |
|---|---|
| Build (483 routes prerendered) | ~4m 45s |
| Upload (51 MB) | ~8s |
| Vercel processing | ~42s |
| **Total (build → alive)** | **~5m 35s** |

Note: The ~42s Vercel processing step is structural — Vercel always downloads and processes files through its Build Output API pipeline, even for prebuilt deployments. This is the floor.

## Auth

Uses `vercel` CLI token stored automatically by `vercel login`. Run `vercel whoami` to verify.

## Vercel Blob (KB Image Hosting)

Vercel Blob is S3-compatible object storage integrated into Vercel's CDN. Use it to host KB images outside `public/` to avoid ballooning the deploy artifact (every file in `public/` ships to CDN on each deploy).

**Setup (one-time per project):**

1. Vercel dashboard → Project → Storage → Blob → Create
2. Copy the `BLOB_READ_WRITE_TOKEN`
3. Add to `.env.local`: `BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."`

**Uploading images:**

```bash
node scripts/upload-assets.mjs docs/public/chemistry chemistry
```

Batch-uploads a directory, skips files already in blob, and prints a JSON manifest mapping filenames → blob URLs. Use `--dry-run` to preview.

**After uploading:**

1. Replace image `src` references in `.md` files from `/chemistry/X.webp` to the blob URL from the manifest
2. Remove the `docs/public/chemistry/` directory
3. Run `node scripts/check-assets.mjs` to confirm no large files remain

**Server utilities** (`layer/server/utils/blob.ts`):

- `uploadBlob(pathname, body)` — upload a single file
- `deleteBlob(pathname)` — remove from blob
- `listBlobs(prefix?)` — list all files
- `blobExists(pathname)` — check existence
