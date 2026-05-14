# TockDocs assistant internals

## Overview

The assistant is a docs-grounded chat system built from four layers:

1. **Route-aware layer UI** in `layer/app`
2. **Assistant runtime + shared state** in `layer/modules/assistant/runtime`
3. **Docs retrieval backend** — three options gated by `ASSISTANT_FS_BACKEND`:
   - **MCP** (`layer/server/mcp/tools`) — `search-pages`, `list-pages`, `get-page`
   - **INDEX** (`layer/server/utils/index-generator.ts`) — injects a generated `INDEX.md` into the system prompt, exposes only `get-page`
   - **GitFS** (`layer/modules/assistant/runtime/server/utils/gitfs-bash.ts`) — mounts docs at `/repo` and gives the model a `bash` tool
4. **Provider resolution + streaming** in `layer/modules/assistant/runtime/server`

Both backends scope retrieval to the current KB and locale, derived from the request referer. Answers are supposed to come from the docs, not generic model memory. The system prompt explicitly tells the model to use documentation tools for substantive questions.

## Request Flow

```text
                              Assistant request flow
┌──────────────────────────────────────────────────────────────────────────────┐
│ AskAiButton / FloatingInput / Explain with AI                               │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ useAssistant() + AssistantPanel.vue                                         │
│ @ai-sdk/vue Chat + DefaultChatTransport                                     │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ POST /__tockdocs__/assistant
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ runtime/server/api/search.ts                                                │
│ scope from referer · provider/model resolution · backend fork               │
└───────────┬──────────────────────────────────────┬───────────────────────────┘
            │ ASSISTANT_FS_BACKEND=mcp             │ ASSISTANT_FS_BACKEND=index
            ▼                                      ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────────────┐
│ MCP client bootstrap            │  │ Fetch INDEX.md for scope               │
│ search-pages · list-pages       │  │ inject into system prompt              │
│ · get-page                      │  │ expose only get-page                   │
└───────────────┬─────────────────┘  └───────────────┬─────────────────────────┘
                │                                    │
                │ scoped to kb/locale                │ scan index in prompt
                ▼                                    ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────────────┐
│ Nuxt Content + /source md       │  │ get-page (single call)                 │
│ + hybrid FlexSearch/Fuse        │  │ reads full markdown from /source      │
└───────────────┬─────────────────┘  └───────────────┬─────────────────────────┘
                │                                    │
                ├────────────────────────────────────┤
                │       ASSISTANT_FS_BACKEND=gitfs   │
                ▼                                    │
┌─────────────────────────────────────────┐          │
│ GitFS + just-bash init                  │          │
│ mount docs/content/<kb>/<locale>        │          │
│ at /repo                               │          │
└───────────────┬─────────────────────────┘          │
                │ scoped by mount root                 │
                ▼                                    │
┌─────────────────────────────────────────┐          │
│ bash tool: rg, find, ls, cat            │          │
│ raw filesystem exploration             │          │
└───────────────┬─────────────────────────┘          │
                │                                    │
                └──────────────┬─────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ streamText() — same model, same streaming transport, same stop logic        │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ UI stream → AssistantLoading · MDCCached · AssistantPreStream               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## UI Wiring and Shared State

### Entry Points in the Layer Shell

The current layer shell uses these assistant entrypoints:

| Surface | File | Behavior |
| --- | --- | --- |
| Header trigger | `layer/app/components/AskAiButton.vue` | Toggles the panel without forcing a new prompt |
| Floating prompt | `layer/modules/assistant/runtime/components/AssistantFloatingInput.vue` | Sends `open(message, true)` so a fresh question starts a fresh chat |
| Right-sidebar action | `layer/app/components/docs/DocsAsideRightBottom.vue` | Opens the panel with `Explain the page <route.path>` and clears prior chat |
| Main chat surface | `layer/modules/assistant/runtime/components/AssistantPanel.vue` | Docked desktop panel or mobile `USlideover` |

`layer/app/app.vue` mounts `LazyAssistantPanel` and `LazyAssistantFloatingInput` inside `ClientOnly` when `useAssistant().isEnabled` is true. It also shifts the main app shell right by the docked panel width so the desktop sidebar does not overlap the page.

`AssistantChat.vue` still exists as a reusable generic trigger component, but the layer header currently uses `AskAiButton` instead.

`layer/modules/assistant/index.ts` is the module entrypoint responsible for:

- enable / disable detection
- public runtime config (`runtimeConfig.public.assistant`)
- assistant-specific component registration
- the assistant API route (`apiPath`, default `/__tockdocs__/assistant`)

When the assistant is disabled, registered assistant components resolve to `AssistantChatDisabled.vue`, and the layer shell also avoids mounting the panel / floating input.

### `useAssistant()`

`layer/modules/assistant/runtime/composables/useAssistant.ts` holds shared assistant state with `useState()`:

- `isOpen`
- `isResizing`
- `desktopWidth`
- `messages`
- `pendingMessage`
- `faqQuestions`
- `isHydrated`

Important behavior:

- chat state survives navigation **within the same KB / locale**
- chat is cleared automatically when the active KB or locale changes
- `shouldPushContent` tells the app shell to shift the page right when the desktop assistant is docked
- `toggleExpanded()` switches the desktop width between compact (`352px`) and expanded (`520px`)
- desktop width is clamped between `320px` and `520px`

### `AssistantPanel.vue`

`AssistantPanel.vue` creates a `Chat` instance from `@ai-sdk/vue` and sends messages through `DefaultChatTransport` to `config.public.assistant.apiPath`.

Main behavior:

- **desktop:** docked right sidebar, resizable from `320px` to `520px`
- **mobile:** `USlideover`
- streams tool activity and assistant text into one message flow
- supports stop / regenerate through `UChatPromptSubmit`
- syncs its local `Chat` instance back into shared `messages` state on finish
- clears local chat state when shared `messages` are reset

On docs pages, the right TOC column hides only after hydration when the assistant is open, which avoids SSR/client rendering mismatches.

### Rendering Helpers

Before MDC parsing, `sanitizeAssistantText()` escapes bare `<word` tags so values like `<kb>` or `<locale>` are not treated as Vue components. Autolinks such as `<https://...>` are preserved.

Supporting components:

- **`AssistantLoading.vue`** — loading text rotation + streamed tool call display
- **`AssistantMatrix.vue`** — animated 4×4 dot-matrix indicator
- **`AssistantPreStream.vue`** — progressive code highlighting using a cached Shiki highlighter
- **`useHighlighter()`** — singleton Shiki setup for Vue, JS, TS, CSS, HTML, JSON, YAML, Markdown, and Bash

## Server Request Handling and Streaming

### End-to-End Request Handling

`layer/modules/assistant/runtime/server/api/search.ts` handles the assistant endpoint.

For each request it:

1. reads `messages` from the request body
2. derives KB / locale scope from the request `referer` via `resolveDocsRoute()`
3. resolves the provider + model via `getAssistantProviderConfig()`
4. determines the active backend from `ASSISTANT_FS_BACKEND` (default `mcp`)
5. **INDEX path:** fetches `INDEX.md` for the scoped KB/locale, estimates tokens, injects it into the system prompt. Falls back to MCP when the index is missing, fails to load, or exceeds the 8K token budget.
6. **MCP path:** appends `kb` / `locale` query params to the MCP transport URL and loads tools with a `30s` connect timeout
7. **GitFS path:** initializes GitFS + just-bash, mounts `docs/content/<kb>/<locale>` at `/repo`, and exposes a single `bash` tool
8. runs `streamText()` with the backend-specific tool set and system prompt, returns `createUIMessageStreamResponse()`
8. cleans up resources (MCP client close or workspace directory removal) and logs duration / tool counts on finish

If there is no usable `referer`, the assistant falls back to:

- `kb = undefined`
- `locale = default locale`
- GitFS mounts `docs/content` (the full content tree) when there is no KB scope

### System Prompt

Three KB-aware prompts live in `layer/modules/assistant/runtime/server/utils/system-prompt.ts`:

- `getMcpSystemPrompt()` — instructions for `search-pages`, `list-pages`, `get-page`
- `getIndexSystemPrompt()` — injects the `INDEX.md` content and instructs the model to scan it and call `get-page` with matching URLs
- `getGitFsSystemPrompt()` — instructions for the `bash` tool (`rg`, `find`, `ls`, `cat`)

All three share the same identity, formatting, and response-style rules from `getIdentitySection()` and `getSharedPromptTail()`.

Shared rules:

- identity comes from `assistantName`, then `kb.title`, then the fallback name `${siteName} Assistant`
- never use first person (`I`, `me`, `my`)
- use a documentation tool before answering substantive docs questions
- never use markdown headings
- simple greetings or UI/meta questions can be answered without tools

MCP-specific:

- use `search-pages` first, retry with shorter keywords
- use `list-pages` for browsing, `get-page` for full context
- prefer URLs returned by tools

GitFS-specific:

- start with `rg "keyword" /repo`
- always `cat` the full file before answering
- cite filesystem paths (not public URLs)
- `/repo` is read-only

### MCP Transport Modes

The assistant supports three MCP transport shapes:

- **external HTTP** — full external MCP URL
- **internal dev HTTP** — same-origin HTTP fetch during local dev
- **internal local fetch** — same-origin `event.fetch()` in production to avoid an extra HTTP hop

The MCP timeout only guards the initial connect + tools/list phase. Once tools are loaded, the timeout is cleared and model generation can continue normally.

### `streamText()` Settings

Current server settings:

- `maxOutputTokens: 6000`
- `maxRetries: 2`
- `MAX_STEPS = 10`
- stop when the **last** step has text and no tool calls, or when `MAX_STEPS` is reached

Tool calls are emitted into the UI stream as `data-tool-calls` parts so the client can show them live while text is still streaming.

## Retrieval Backends

### MCP (default)

`layer/server/mcp/tools/` exposes three read-only tools, each cached for **1 hour**:

| Tool | Purpose |
| --- | --- |
| `search-pages` | Searches titles, descriptions, headings, path tokens, and body text |
| `list-pages` | Returns a flat list of page metadata (`title`, `path`, `description`, `url`) across scoped collections |
| `get-page` | Returns full original markdown + metadata for an exact routed path |

**Scope enforcement:**

- `getScopedKnowledgeBaseAndLocale()` normalizes explicit tool args, transport query params, and malformed model input
- `isPathWithinDocsScope()` (in `layer/server/utils/content.ts`) prevents `get-page` from fetching paths outside the active KB/locale
- Scope is logged through `[tockdocs-mcp-scope]`

### INDEX (Opt-In)

When `ASSISTANT_FS_BACKEND=index`, the assistant:

1. Resolves the scoped KB/locale from the request
2. Fetches a pre-built `INDEX.md` (or generates it on demand in dev) via `GET /__tockdocs__/index/<kb>/<locale>.md`
3. Estimates the token count; if over 8K tokens, falls back to MCP
4. Connects to the MCP server and filters tools to **only `get-page`**
5. Injects the `INDEX.md` into the system prompt via `getIndexSystemPrompt()`

**Index format:**

```markdown
# Knowledge Base: Chemistry (zh)

- [Page Title](/docs/chemistry/zh/topic/page.md)
  Summary: One-paragraph description of what this page covers.
```

The index is generated per KB × locale at build time by `layer/modules/index-generator.ts`. Each entry includes the page title, a `.md` alias URL, and the `description` frontmatter field as a summary. Pages without a `description` show only the title and URL.

**Key properties:**

- Uses existing `description` frontmatter — no new fields needed
- Indexed in Nuxt Content collection order
- `.navigation` pseudo-pages are excluded
- Dev mode: generated on first request, cached in memory (10s TTL dev, 60s prod)
- Production: pre-built assets in `.data/index/` shipped as Nitro server assets

### GitFS (Opt-In)

When `ASSISTANT_FS_BACKEND=gitfs`, the assistant mounts `docs/content/<kb>/<locale>` at `/repo` via `@taowang1993/gitfs` + `just-bash` and exposes a single `bash` tool:

- `rg`, `find`, `ls` — discover pages
- `cat` — read full content
- `grep -r` — recursive search

**Scope enforcement:**

- the mount root is the KB/locale subtree, so the model cannot `ls` or `cat` outside it
- parent-directory traversal and absolute paths outside `/repo` or `/workspace` are blocked in `validateGitFsCommand()`
- a `PersistentGitFsCache` in `/tmp/gitfs-cache` keeps warm invocations fast

### Source Markdown Pipeline

The assistant retrieves **original markdown**, not rendered HTML.

- `search-pages` and `get-page` fetch source content through `/source<path>.<ext>`
- `/raw<path>.<ext>` remains available as a proxy alias to `/source...`
- user-facing tool results point to canonical `.md` alias URLs such as `/docs/manual/en/getting-started.md`

That means the model reads the real authoring source while users receive stable, markdown-friendly links.

### Search Pipeline (MCP)

`layer/server/utils/docs-search.ts` builds an in-memory search index from Nuxt Content pages plus original markdown fetched through `/source<path>.<extension>`.

Retrieval pipeline:

1. **FlexSearch** primary pass
2. **Fuse.js** fallback when FlexSearch is weak
3. **Lenient Fuse** retry when zero results remain
4. **Script-only retry** for mixed Latin + CJK-style queries

Other important details:

- the cache is **scope-aware** (KB / locale) rather than one giant global index
- cache TTL is **60s in prod** and **10s in dev**
- `.navigation` pseudo-pages are excluded from indexing
- scoring heavily favors `title` and `headings` over body text
- excerpts are generated from raw markdown, centered around the first matched query term

## Provider Resolution

Supported providers:

- `vercel`
- `openrouter`
- `deepseek`
- `nvidia`
- `huggingface`
- `groq`
- `github`
- `gemini`
- `cloudflare`

### Default Models

| Provider | Required server credentials | Default model |
| --- | --- | --- |
| `vercel` | `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` | `google/gemini-3-flash` |
| `openrouter` | `OPENROUTER_API_KEY` | `minimax/minimax-m2.5:free` |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` |
| `nvidia` | `NVIDIA_API_KEY` | `minimaxai/minimax-m2.7` |
| `huggingface` | `HUGGINGFACE_API_KEY` | `deepseek-ai/DeepSeek-V4-Pro:together` |
| `groq` | `GROQ_API_KEY` | `openai/gpt-oss-120b` |
| `github` | `GITHUB_TOKEN` | `openai/gpt-5` |
| `gemini` | `GEMINI_API_KEY` | `gemini-3.1-flash-live-preview` |
| `cloudflare` | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` | `@cf/google/gemma-4-26b-a4b-it` |

### Auto-Detection Order

When `AI_PROVIDER` is unset, the server picks the first configured provider in this order:

1. Vercel
2. OpenRouter
3. DeepSeek
4. NVIDIA
5. Hugging Face
6. Groq
7. GitHub
8. Gemini
9. Cloudflare

Overrides:

- `AI_PROVIDER` forces the provider
- `AI_MODEL` or `tockdocs.assistant.model` forces the model

Backend mapping:

- **Vercel** → `@ai-sdk/gateway`
- **Gemini** → `@ai-sdk/google`
- **All others** → `@ai-sdk/openai-compatible`

OpenRouter adds `HTTP-Referer` and `X-Title` headers when the configured site URL is HTTPS.

## Configuration Surfaces

### `nuxt.config.ts`

Assistant runtime options live under `tockdocs.assistant`:

- `apiPath`
- `mcpServer`
- `provider`
- `model`

The legacy top-level `assistant` config is still read, but it is deprecated.

### `app.config.ts`

Assistant UI options live under `assistant`:

- `floatingInput`
- `explainWithAi`
- `faqQuestions`
- `shortcuts.focusInput`
- `icons.trigger`
- `icons.explain`

`faqQuestions` supports:

- a flat string array
- categorized groups
- locale-keyed objects

## Logging and Operational Notes

Three log prefixes matter:

- **`[tockdocs-assistant]`** — request lifecycle, provider/model choice, tool calls, duration, errors
- **`[tockdocs-docs-search]`** — search index builds, queries, retries, top paths
- **`[tockdocs-mcp-scope]`** — final KB / locale scope resolution

Useful `toolCallCount` heuristics from assistant logs:

- `0` — greeting/meta answer or missed retrieval
- `1` — INDEX: scanned prompt + fetched matching page; or MCP: searched and answered from excerpts
- `2` — MCP: searched, then fetched a full page
- `3+` — retries or a more complex multi-step lookup

A single `get-page` call with `fsBackend: index` is the expected fast path. With `fsBackend: mcp`, a search + get-page pattern typically takes 2 calls.

Operational behavior:

- in **dev**, the assistant UI is always enabled
- in **production**, the UI is enabled when supported credentials exist or `NUXT_PUBLIC_ASSISTANT_ENABLED=true`
- if UI is forced on but no provider is actually configured, the endpoint returns `503`
- assistant state is scoped to the active KB / locale, not shared globally across the whole site
