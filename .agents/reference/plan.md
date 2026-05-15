# Development Plan

## Build-Time Search Index Pre-Generation

### Problem

The MCP backend's `search-pages` tool builds an in-memory FlexSearch + Fuse.js index on first access per KB/locale scope. Building this index requires fetching source markdown for every page via `event.$fetch()` — 60 HTTP round-trips for chemistry/zh alone. This cold-start cost adds 5–10 seconds to the first query after deployment. The cache is `POSITIVE_INFINITY` TTL (server-lifetime), so subsequent requests are fast, but Vercel serverless cold-starts reset it.

The INDEX backend avoids this entirely by pre-generating `INDEX.md` at build time and injecting it into the system prompt — but it removes the full-text search step, relying on the model to pick the right page from descriptions alone. For school use cases with zero-tolerance for inaccurate answers, `search-pages`'s full-text FlexSearch is essential.

### Distinction from the INDEX Backend

| | INDEX Backend | MCP + Build-Time Search Index (proposed) |
|---|---|---|
| **Retrieval** | Model reads flat page catalog from system prompt, picks a page, calls `get-page` | FlexSearch + Fuse.js full-text search → `get-page` |
| **Tool calls** | 1 (`get-page`) | 2 (`search-pages` → `get-page`) |
| **LLM round trips** | 2 | 3 |
| **Accuracy** | Relies on model judgment + `description` frontmatter quality | Deterministic full-text search across all page content |
| **Cold start** | 0s (INDEX.md pre-built) | **0s after this change** (search index pre-built) |
| **Warm query** | ~5s | ~8s |

The INDEX backend is the correct choice when every page has high-quality `description` frontmatter and the page count stays under ~260 (8K token budget). The MCP backend is the correct choice when full-text search accuracy is non-negotiable. This plan makes the MCP backend viable without a warm-up ritual.

### Approach

Pre-build the FlexSearch + Fuse.js index at build time (same `nuxt build` hook where `INDEX.md` is generated), serialize to JSON, and ship as a Nitro server asset. At runtime, load the pre-built asset instead of building from `event.$fetch`. Fall back to the current behavior when no pre-built asset exists (dev mode, legacy consumers).

FlexSearch's `Document` class supports `export(handler)` / `import(key, data)` for serialization (see `node_modules/flexsearch/index.d.ts:744-747`). The `documents` array and `byId` Map are plain data — no special serialization needed.

### Files to Create

#### `layer/server/utils/search-index-build.ts`

Build-time functions. No runtime dependencies beyond `node:fs` and `node:path`.

```
Exports:
  buildSearchIndexAsset(rootDir, config, scope) → { scopeId, locale, asset }
  buildAllSearchIndexAssets(rootDir, config) → Array<{ scopeId, locale, asset }>

asset format:
{
  version: 1,
  documents: SearchIndexDocument[],   // plain JSON
  flexExport: Record<string, string>, // flex.export() output
}

Implementation:
  1. Read all .md/.mdc files from the scope's source directory
  2. Parse frontmatter via yaml (reuse logic from index-generator.ts)
  3. Extract headings from body
  4. Build SearchIndexDocument[] (same shape as runtime getCollectionDocuments)
  5. Create FlexSearch Document instance, add all documents
  6. Export FlexSearch via flex.export(handler) → Record<string, string>
  7. Return { documents, flexExport }
```

#### `layer/server/utils/search-index-loader.ts`

Runtime loader. Called from `getDocsSearch()`.

```
Exports:
  loadSearchIndexAsset(scope) → DocsSearchIndex | null

Implementation:
  1. Try useStorage('assets:tockdocs-search').getItem(`${scopeId}/${locale}.json`)
  2. If not found, return null
  3. Parse JSON, validate version
  4. Create FlexSearch Document, call flex.import(key, data) for each entry
  5. Create Fuse instance from documents
  6. Rebuild byId Map from documents
  7. Return { flex, fuse, documents, byId }
```

### Files to Modify

#### `layer/modules/index-generator.ts`

After the existing INDEX.md generation loop, add:

```ts
// Also pre-build search index assets for the MCP backend
const searchAssets = buildAllSearchIndexAssets(...)
await Promise.all(searchAssets.map(...write to .data/search/...))
```

Register a second Nitro server asset base (`tockdocs-search`) pointing at `.data/search/`.

**Decision point:** Keep in the same module (single build hook → simpler) or extract into a new `search-index-generator` module. Recommend keeping in the same module since it reuses the same build hook, same config resolution, and same scope iteration. The module name `index-generator` is already ambiguous — rename considerations can happen separately.

#### `layer/server/utils/docs-search.ts`

Modify `getDocsSearch()` — before the current `createDocsSearch(event, scope)` call, try loading from pre-built assets:

```ts
async function getDocsSearch(event, scope) {
  // 1. Check in-memory cache (existing)
  // 2. Try pre-built asset (NEW)
  const prebuilt = await loadSearchIndexAsset(scope)
  if (prebuilt) {
    docsSearchCache.set(key, { promise: Promise.resolve(prebuilt), builtAt: performance.now() })
    return prebuilt
  }
  // 3. Fall back to runtime build (existing)
  return createDocsSearch(event, scope)
}
```

**Important:** The pre-built index loads documents from the filesystem at build time (no `event.$fetch`), but the runtime `createDocsSearch` uses `event.$fetch` to get source markdown. After this change, the runtime path is only a fallback for dev mode and edge cases. The `build_index` log message should distinguish between `source: 'prebuilt'` and `source: 'runtime'`.

### Non-Goals

- **No changes to the INDEX backend.** INDEX.md generation is untouched.
- **No serialization of the Fuse.js index.** Fuse is reconstructed from the `documents` array at load time (O(N) but N < 200).
- **No changes to `search-pages` tool behavior.** Same FlexSearch + Fuse.js pipeline, same scoring, same excerpt generation.
- **No changes to the MCP client connection or LLM flow.** The search index is loaded before `streamText()` begins, same as today.

### Risks

1. **FlexSearch export/import compatibility.** `flex.export()` output format must be stable across FlexSearch versions. If the FlexSearch version changes, increment the asset `version` field and force rebuild. The runtime loader checks `version` and falls back to `createDocsSearch` on mismatch.

2. **Build-time content vs runtime content.** Content source files are the same in production (shipped as Nitro assets), so build-time content matches runtime. In dev, content can change without a rebuild — but dev mode skips build-time generation (same as INDEX.md today) and falls back to `event.$fetch`.

3. **Asset size.** For 60 pages, the serialized index is ~200KB (documents array ~150KB + flexExport ~50KB). For all 4 scopes: ~500KB total. Nitro server assets are loaded into memory on first access, not at boot. Acceptable.

4. **Build time increase.** Build-time cost replaces runtime cost. Building all 4 search indexes takes the same wall-clock time as one cold `search-pages` call today (~5s), but it happens during `nuxt build`, not during a user request. Acceptable trade-off.

### Validation

1. Build the docs site: `pnpm run build` in `docs/`
2. Verify `.data/search/` contains one JSON file per scope
3. Deploy to Vercel, send a `search-pages` query — confirm no `build_index` log (pre-built path used)
4. Run `ASSISTANT_FS_BACKEND=mcp` benchmark from `.agents/skills/backbench/SKILL.md` — expect MCP cold-start latency to match warm latency (~8s, not >12s)
