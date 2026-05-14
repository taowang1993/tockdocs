# INDEX.md Backend — Implementation Plan

## Goal

Add a third retrieval backend (`ASSISTANT_FS_BACKEND=index`) that:

1. Generates a per-KB `INDEX.md` at build time — aggregating every page's URL + summary
2. Injects it into the system prompt (one-time cost per conversation)
3. Exposes only the `get-page` tool — the model scans the index, picks relevant URLs, fetches full content
4. Eliminates the `search-pages` / `list-pages` tool calls (saves one round-trip per query)

```
Before (MCP):  User → search-pages (call 1) → get-page (call 2) → answer
After (INDEX): User → [scans index in prompt] → get-page (call 1) → answer
```

## Design Decisions

### Summary source: reuse `description` frontmatter
No new frontmatter field needed. The existing `description` field (already present on most pages, used by SEO and `list-pages`) serves as the summary. Pages without a `description` show only their title in the index.

### Scoping: per KB × locale
INDEX.md is generated for each KB+locale combination. At query time, the backend picks the index matching the active scope (derived from headers or referer, same as MCP).

### Injection point: system prompt
INDEX.md is prepended to the system prompt. The model sees it once at conversation start. Follow-up messages reuse the same context (standard LLM behavior) — no re-injection needed.

### Fallback: MCP on index too large
If the INDEX.md exceeds a token budget (~8000 tokens), the backend falls back to MCP automatically and logs a warning. This keeps large KBs functional without context-window issues.

### Tool: reuse MCP `get-page`
Still connect to the MCP server for scope enforcement + caching, but only expose `get-page` (filter out `search-pages` and `list-pages` from the tool set). No reimplementation needed.

## Files to Create

| File | Purpose |
|---|---|
| `layer/server/utils/index-generator.ts` | Build-time INDEX.md generation logic |
| `layer/modules/index-generator.ts` | Nuxt module: hooks into build to run the generator |

## Files to Modify

| File | Change |
|---|---|
| `layer/modules/assistant/runtime/server/utils/system-prompt.ts` | Add `getIndexSystemPrompt()` |
| `layer/modules/assistant/runtime/server/api/search.ts` | Add `index` branch in `getAssistantFsBackend()`, fetch index, filter tools, wire system prompt |
| `layer/nuxt.config.ts` | Register the `index-generator` module |

## INDEX.md Format

```markdown
# Knowledge Base: <kb.title> (<locale>)

- [Page Title](https://<site>/.md-url-path)
  Summary: One-paragraph description of what this page covers.

- [Another Page](https://<site>/.md-url-path)
  Summary: ...
```

- Uses canonical `.md` alias URLs (same as `get-page` returns), e.g. `/docs/parser/en/parser/landingai-ade-vs-nanonets-vs-tensorlake.md`
- Pages without a `description` show title + URL only (no "Summary:" line)
- Pages are listed in the order they appear in the Nuxt Content collection
- `.navigation` pseudo-pages are excluded (same filter as `list-pages`)

## Implementation Steps (in order)

### Step 1 — Build-time generator

**`layer/server/utils/index-generator.ts`**

```ts
// Core function:
//   generateIndex(kb: string, locale: string, pages: IndexPage[]) => string
//
// IndexPage shape:
//   { title: string, path: string, description?: string, url: string }
//
// Generates the markdown string per the format above.
// URL construction uses buildDocsPageUrl() from layer/utils/docs.ts
// (must accept siteUrl as parameter since site URL isn't known at build time
//  — use a placeholder like __SITE_URL__ that gets resolved at runtime, OR
//  generate relative paths and resolve at serve time).
```

**Decision: relative paths at build time → absolute URLs at serve time.**

The generator produces relative `.md` paths (e.g., `/docs/parser/en/parser/foo.md`). The server route that serves the INDEX.md resolves them to absolute URLs using the request origin. This avoids baking a deployment URL into build artifacts.

**`layer/modules/index-generator.ts`**

Nuxt module that:
1. Hooks into `nuxt-build:before` or a Nitro build hook
2. Iterates over all resolved KBs × locales (from runtime config or `layer/utils/knowledge-bases.ts`)
3. For each KB+locale, queries the corresponding Nuxt Content collection
4. Extracts `title`, `path`, `description` from each page
5. Filters out navigation pseudo-pages (`isSearchableContentPath`)
6. Calls `generateIndex()` and writes the result to a known location

**Where to store:** Use Nitro server assets, following the same pattern as source markdown:

```ts
// In nuxt.config.ts or the module:
nitro: {
  serverAssets: [{
    name: 'tockdocs-index',
    dir: '.data/index', // build output directory
    // files: index_<kb>_<locale>.md
  }]
}
```

Or simpler: write INDEX.md files to a directory under `layer/server/assets/index/` and use `useStorage()` at runtime.

**Simplest approach (recommended):** Write to `layer/.data/index/` at build time, configure as a Nitro server asset. At runtime, read via `useStorage('assets:tockdocs-index')`.

### Step 2 — Runtime server route

Serve the INDEX.md at `GET /__tockdocs__/index/:kb/:locale.md`.

- Reads the pre-built INDEX.md from server assets
- Resolves relative paths to absolute URLs using the request origin
- Returns `text/markdown` with appropriate caching headers
- Returns 404 if no index exists for that KB/locale

**Where to add:** `layer/server/routes/__tockdocs__/index/[kb]/[locale].get.ts` (Nitro file-based route).

### Step 3 — System prompt

**`layer/modules/assistant/runtime/server/utils/system-prompt.ts`**

Add `getIndexSystemPrompt()`:

```ts
export function getIndexSystemPrompt(
  siteName: string,
  scopeLabel: string | undefined,
  kb: AssistantKbMeta | undefined,
  indexContent: string
) {
  return `${getIdentitySection(siteName, scopeLabel, kb)}

**Documentation index (read this first):**
${indexContent}

**Tool usage:**
- You have ONE tool: get-page — use it to read the full content of any page listed in the index above
- Scan the index to find relevant pages for the user's question
- Call get-page with the exact path from the index to fetch the full markdown
- After reading a page, answer from its content
- If no page in the index seems relevant, say so — don't guess

**Links and citations:**
- Tool results include a \`url\` — use it for citations as markdown links \`[title](url)\`
- Prefer URLs from tool results so links stay valid

${getSharedPromptTail(siteName, kb)}`
}
```

### Step 4 — Backend fork in search.ts

**`layer/modules/assistant/runtime/server/api/search.ts`**

In `getAssistantFsBackend()`, add `'index'` as a valid return value:

```ts
function getAssistantFsBackend(config) {
  const backend = String(config.assistant.assistantFsBackend || '').toLowerCase()
  if (backend === 'gitfs') return 'gitfs'
  if (backend === 'index') return 'index'
  return 'mcp'
}
```

In the main handler, add an `index` branch after the `gitfs` block and before the `else` (MCP) block:

```ts
else if (fsBackend === 'index') {
  // 1. Fetch INDEX.md for the scoped KB/locale
  const indexUrl = `/__tockdocs__/index/${assistantScope.kb}/${assistantScope.locale}.md`
  const indexResponse = await event.fetch(indexUrl)
  let indexContent = ''
  if (indexResponse.ok) {
    indexContent = await indexResponse.text()
  } else {
    // Fall back to MCP if index doesn't exist
    logAssistant('index_fallback', { reason: 'no index found' })
    fsBackend = 'mcp'
    // ... fall through to MCP branch (restructure to allow this)
  }

  if (fsBackend === 'index') {
    // 2. Estimate token count and fall back if too large
    const estimatedTokens = indexContent.length / 4 // rough estimate
    if (estimatedTokens > 8000) {
      logAssistant('index_fallback', { reason: 'index too large', estimatedTokens })
      fsBackend = 'mcp'
    }
  }

  if (fsBackend === 'index') {
    // 3. Connect to MCP for get-page tool only
    //    (same MCP connection code, but filter tools)
    const httpClient = await createMCPClient({ transport })
    const allTools = await httpClient.tools()
    tools = { get_page: allTools.get_page } // only expose get-page

    // 4. Build system prompt with index injected
    systemPrompt = getIndexSystemPrompt(siteName, assistantScope.scopeLabel, activeKb, indexContent)

    // 5. Cleanup
    closeResources = async () => { await httpClient?.close() }
  }
}
```

**Refactoring note:** The MCP connection code is currently duplicated (once in the `else` block, once needed for the `index` branch). Extract the MCP connection + tool loading into a shared helper `createMcpTools(event, assistantScope)` to avoid triplication.

### Step 5 — Register the module

**`layer/nuxt.config.ts`**

Add `'./modules/index-generator'` to the modules array (alongside the existing local modules like `config`, `routing`, `assistant`, etc.).

## Edge Cases

| Case | Behavior |
|---|---|
| No `description` on a page | Show title + URL only, no "Summary:" line |
| INDEX.md doesn't exist for KB/locale | Fall back to MCP, log warning |
| INDEX.md exceeds ~8000 tokens | Fall back to MCP, log warning |
| KB has no pages (empty collection) | Generate empty index with a note; model answers from identity |
| Multi-KB site, user switches KB | New conversation gets the new KB's INDEX.md (existing scope-change logic handles this) |
| Dev mode (no build artifacts) | Generate INDEX.md on first request and cache in memory (TTL same as search cache: 10s dev, 60s prod) |
| `ASSISTANT_FS_BACKEND` unset or invalid | Defaults to `mcp` (unchanged behavior) |

## Testing Strategy

### Manual (playground)

1. Set `ASSISTANT_FS_BACKEND=index` in `playground/.env`
2. Build playground: `pnpm run build:playground`
3. Verify INDEX.md is generated at `/__tockdocs__/index/<kb>/<locale>.md`
4. Ask the assistant a question — verify:
   - No `search-pages` or `list-pages` tool calls in logs
   - Only `get-page` calls
   - Answer is grounded in docs
   - Links in answer point to correct URLs

### Automated

- Unit test for `generateIndex()` in `layer/server/utils/index-generator.ts`
- Unit test for `getIndexSystemPrompt()` in the system-prompt test suite
- Integration test: verify the INDEX.md server route returns valid markdown

## Token Budget Reference

| KB Size | Pages | Avg Description | Estimated Tokens | Viable? |
|---|---|---|---|---|
| Small | 50 | 15 words | ~1,500 | Yes |
| Medium | 150 | 15 words | ~4,500 | Yes |
| Large | 300 | 15 words | ~9,000 | Borderline → fallback |
| X-Large | 500+ | 15 words | ~15,000 | No → MCP fallback |

At ~30 tokens per indexed entry (title + URL + summary), 8K token budget ≈ ~260 pages. This covers most real-world KBs.

## Future Enhancements (not in v1)

- **Tiered index:** Section headings only → model requests sub-index → get-page. For KBs > 300 pages.
- **Hybrid mode:** Send INDEX.md alongside MCP tools. Model can search OR scan index.
- **AI-generated summaries:** Build-time LLM pass to produce retrieval-optimized summaries for pages without good `description` fields.
- **Per-page `summary` frontmatter:** Fall back chain: `summary` → `description` → title only.
