# Serverless Deployment Guidelines

> Platform-agnostic principles for keeping serverless bills low. Applies anywhere that bills by compute time + bandwidth.

## 1. Assets: keep large files out of your repo

Every file in `public/` gets pushed to the CDN on deploy. CDN bandwidth is the #1 cause of surprise bills.

| Asset type | Where to put it |
|---|---|
| favicon, logo SVGs, small icons (<10KB) | `public/` — tiny, benefits from edge caching |
| Screenshots, diagrams, photos | Object storage (S3-compatible, R2) |
| Videos, large PDFs, audio | Object storage only — never in `public/` |

**Rule:** if a file is larger than ~50KB and doesn't change with every deploy, host it externally. Object storage + CDN is cheaper than putting assets in the deploy artifact.

**TockDocs chemistry KB:** 7MB across 102 WebP images in `public/` is borderline. If traffic grows, move them to object storage and serve via CDN.

## 2. Image optimization: pre-optimize at build time

Most platforms offer on-the-fly image resizing/conversion. They bill per *source image* or per *transformation*, not per request. A single image at 3 sizes = 3 billed transformations.

**What we do in TockDocs:**
- Disabled runtime optimization entirely
- Pre-convert all images to WebP at build time (`cwebp -q 90`)
- Serve as static files — zero per-image billing

**What to avoid:**
- Runtime image components generating dozens of size variants
- Allowing arbitrary remote URLs through your optimization endpoint (open relay = bill multiplier)
- Deploying unoptimized multi-megabyte PNGs

### Vercel Blob

Vercel Blob is S3-compatible object storage integrated into Vercel's CDN. It's the recommended way to host KB images outside `public/`.

**Setup (one-time per project):**
1. Vercel dashboard → Project → Storage → Blob → Create
2. Copy the `BLOB_READ_WRITE_TOKEN`
3. Add to `.env.local`: `BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."`

**Uploading images:**
```bash
node scripts/upload-assets.mjs docs/public/chemistry chemistry
```
This batch-uploads a directory, skips files already in blob, and prints a JSON manifest mapping filenames → blob URLs. Use `--dry-run` to preview.

**After uploading:**
1. Replace image `src` references in `.md` files from `/chemistry/X.webp` to the blob URL from the manifest
2. Remove the `docs/public/chemistry/` directory
3. Run `node scripts/check-assets.mjs` to confirm no large files remain

**Server utilities** (`layer/server/utils/blob.ts`):
- `uploadBlob(pathname, body)` — upload a single file
- `deleteBlob(pathname)` — remove from blob
- `listBlobs(prefix?)` — list all files
- `blobExists(pathname)` — check existence

## 3. Database queries: run in parallel, not sequentially

Serverless bills by **compute time**. Every millisecond a function sits blocked waiting for a database response costs money.

```js
// ❌ Sequential — 4 × 50ms = 200ms billed per request
const posts = await db.posts.findMany()
const comments = await db.comments.findMany({ where: { postId } })
const author = await db.users.findFirst({ where: { id: post.userId } })
const commentAuthors = await db.users.findMany({ where: { id: { in: commentUserIds } } })

// ✅ Parallel — ~50ms billed per request
const [posts, comments, author, commentAuthors] = await Promise.all([...])
```

- Use **joined/included relations** in ORM queries instead of N+1 fetches
- Run independent queries in parallel (`Promise.all`)
- Every 50ms of blocking = 50ms of billing

## 4. Cache expensive computations

If data doesn't change on every request, don't recompute it on every request.

- **Edge cache** (CDN-level): for fully static responses. Set `Cache-Control` headers.
- **KV store**: for semi-dynamic data shared across invocations (session data, feature flags).
- **Function-level cache**: for expensive queries that change infrequently. Invalidate when data changes.

```js
// Generic pattern for any KV-backed cache
async function getCachedData(key, fetcher, ttl = 3600) {
  const cached = await kv.get(key)
  if (cached) return cached
  const fresh = await fetcher()
  await kv.set(key, fresh, { ttl })
  return fresh
}
```

- Cache user session/auth data — don't query the database on every request
- Revalidate on data change, not on a timer

## 5. Prerender everything that is static

If a page shows the same content to every user, generate it at **build time**, not per request.

| Pattern | Cost |
|---|---|
| Static / prerendered | Zero per-request (served from CDN) |
| Server-rendered (SSR) | Function invocation per request |
| ISR / stale-while-revalidate | Function invocation on cache miss only |

- Docs, blogs, landing pages, ToS → **prerender**
- Only SSR for pages with per-user, per-request data
- **TockDocs:** all docs pages prerendered by default via Nuxt Content

## 6. Queue long-running work

Serverless functions are priced by duration. Blocking for 20 seconds on an AI generation means paying for 20 seconds of idle time.

- AI generations, video transcoding, PDF exports → **offload to a queue**
- Request handler fires off the job and returns immediately
- A worker updates the result when done (or client polls / uses WebSocket)

## 7. Monitoring & safety nets

- **Set billing alerts** at 50% and 80% of your monthly budget
- **Check build output** after every deploy — one misconfigured page can silently add compute costs
- **Scan `public/` for large files** before deploy (CI check for anything >100KB)
- **Monitor function duration** (p50, p95, p99) — spikes indicate N+1 queries or missing caches
- **Prefer self-hosted analytics** (PostHog, Plausible, Umami) over platform-locked options that bill per event

## Quick checklist

- [ ] Large assets (>50KB) hosted externally, not in `public/`
- [ ] Images pre-optimized (WebP/AVIF) at build time, not runtime
- [ ] Database queries run in parallel, not sequentially
- [ ] Heavy computations cached with appropriate TTLs
- [ ] Static pages prerendered, not server-rendered
- [ ] Long-running tasks offloaded to a queue
- [ ] Billing alerts configured
- [ ] Build output reviewed for unexpected serverless functions
