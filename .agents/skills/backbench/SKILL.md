---
name: backbench
description: Benchmark the three ASSISTANT_FS_BACKEND strategies (INDEX, MCP, GitFS) with real-browser speed tests. Use when comparing backend performance, testing after code changes, choosing a default backend, or investigating user-reported assistant latency. Make sure to use this skill whenever the user mentions benchmarking the assistant backends, comparing MCP vs INDEX vs GitFS, measuring assistant speed or latency, testing which filesystem backend is faster, or evaluating assistant backend performance — even if they don't explicitly say "benchmark."
---

## Overview

Two test scripts measure assistant backend speed:

- **`scripts/test-backend.mjs`** — Raw `fetch()` to `/__tockdocs__/assistant`. Measures first SSE token (server-side prefill latency).
- **`scripts/test-browser.cjs`** — Chromium + Playwright, full Vue hydration. Measures real user-perceived time: Ask AI → type → Enter → first visible paragraph.

> **Raw API TTFT is misleading for backend comparison.** MCP has the fastest raw TTFT (lean system prompt → model starts reasoning sooner), but INDEX wins on real-browser answer time because it skips the search round-trip. Always use the browser test for decision-making.

## Prerequisites

- Dev server on port 4987 with `ASSISTANT_FS_BACKEND` set
- Chromium: `playwright-cli install-browser chromium`
- Server must be started from the **repo root** with `pnpm run dev` (not from `docs/` directly — the root `.env` contains the AI provider credentials that `docs/.env` lacks)

## Configuring Test Queries

Both scripts read queries from a `TESTS` array near the top of the file. Each entry defines:

```js
{
  name: 'Human-readable label for this test case',
  pageUrl: `${BASE_URL}/docs/<kb>/<locale>/<path-to-page>`,
  query: 'The question to ask the assistant — should require document retrieval, not just model knowledge',
}
```

Before running, edit the `TESTS` array to match the current KBs and content. Pick queries that:

- Reference content that actually exists in the target KB
- Require the assistant to use tools (not answerable from model training data alone)
- Cover different KBs if you have multiple
- Include at least one non-Latin KB if you have one — backend rankings shift by language

The browser test script also needs the `Referer` header adjusted per test — it's set automatically from `pageUrl`.

## Running All Three Backends

```bash
cd ~/projects/knowledge/tockdocs

# Kill any existing server
pkill -f "nuxt" 2>/dev/null
lsof -ti:4987 | xargs kill 2>/dev/null
sleep 2

for backend in mcp index gitfs; do
  ASSISTANT_FS_BACKEND=$backend pnpm run dev > /tmp/tockdocs-$backend.log 2>&1 &
  # Wait for server to be ready
  for i in $(seq 1 45); do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4987/docs/manual/en 2>/dev/null || echo "000")
    [ "$code" = "301" ] || [ "$code" = "200" ] && break
    sleep 2
  done
  sleep 3
  echo "=== $backend ===" && ASSISTANT_FS_BACKEND=$backend node scripts/test-browser.cjs
  pkill -f "nuxt" 2>/dev/null
  lsof -ti:4987 | xargs kill 2>/dev/null
  sleep 2
done
```

## Interpreting Results

The browser script reports two metrics per run:

- **Source indicator time** — when the first tool result or source reference appears in the assistant panel. This is the user's first visual proof that the assistant is working.
- **Answer text time** — when the first substantive paragraph (>50 chars, excluding status labels and tool indicators) renders. This is when the user can start reading the answer.

The relationship between backends is structural, not dependent on specific KB content:

- **INDEX** — 1 tool call (`get-page`). Skips search entirely. The page catalogue is in the system prompt, so the model picks the right URL and fetches content in one round trip. Fastest answers.
- **MCP** — 2–4 tool calls (`search-pages` → `get-page`). Model searches first, then fetches. An extra model round-trip adds latency. Works with any KB structure and requires no frontmatter, but search quality degrades on non-Latin text (CJK, Arabic, etc.), causing the model to retry with reformulated queries.
- **GitFS** — 3–8 tool calls (`bash`: `rg`, `cat`, `ls`). Model explores the filesystem iteratively. Each bash call is a round trip. Slowest answers, but enables grep/cross-file patterns that the other backends can't express.

### Language Matters

MCP's search pipeline (FlexSearch → Fuse.js) is optimized for Latin text tokenization. On CJK and other non-Latin KBs, FlexSearch produces weak results and Fuse.js falls back to fuzzy matching with degraded relevance. The model, seeing poor search results, often retries with reformulated queries — each retry adds one model round-trip (~4s with DeepSeek). This can double or triple MCP's answer time on non-Latin KBs.

INDEX and GitFS are language-agnostic. INDEX reads the pre-built page catalogue directly (no search to degrade). GitFS greps raw text with `rg`, which handles Unicode equally well across all languages.

When benchmarking, always test each KB in its primary locale. The server logs expose the search degradation: look for `"usedFuseFallback":true` and multiple `"toolCalls":["search-pages"]` entries before a `get-page` call.

### The INDEX Advantage

INDEX is faster because it eliminates the search step. The model doesn't need to decide what to search for, issue a query, read results, and then pick a page. It reads the catalogue (injected into the system prompt at request time), identifies the relevant page immediately, and fetches it. One tool call, one answer.

INDEX falls back to MCP automatically if the index exceeds 8,000 tokens or can't be fetched. Check server logs for `"index_fallback"` to see if this is happening.

## How the Browser Test Works (Internals)

```
1. page.goto(pageUrl)              Navigate to a KB page (1920×1080 viewport)
2. click Ask AI button             Open assistant panel (testid: ask-ai-btn)
3. find textarea in <aside>        Locale-agnostic: aside textarea (other textareas are outside <aside>)
4. fill textarea with query        Type the question
5. click Send prompt               Submit — t0 = Date.now()
6. waitForFunction(article)        Poll DOM for new <article> in assistant <aside>
   → sourceTime = now - t0         First tool/source indicator visible
7. waitForFunction(>50 chars)      Poll for substantive paragraph text
   → textTime = now - t0           First answer paragraph visible
```

The assistant panel is an `<aside>` element (not `[role="complementary"]`). The textarea placeholder changes per locale ("Ask a question...", "请问...", etc.), but the script locates it by structure: `aside textarea` — other textareas (floating input) live outside `<aside>` elements, so this selector is safe across locales. AI responses appear as `<article>` elements inside the aside. Pre-stream status labels and tool indicators are filtered out before measuring answer time.

The viewport is set to 1920×1080 to avoid "element is outside of the viewport" errors — at the default headless Chromium size (1280×720), the assistant sidebar's textarea can render partially offscreen on some KB pages.

## Pitfalls

### Wrong env loading

Always start from the repo root with `pnpm run dev`. Starting from `docs/` with `pnpm run dev` loads `docs/.env` which lacks the AI provider settings, causing the server to fall back to Vercel AI Gateway — which may have exhausted free credits.

### Vercel credit exhaustion

If the server log shows `"provider":"vercel"` instead of your configured provider, Vercel auto-detection kicked in. Requests will fail with `"Free credits temporarily have restricted access..."`. Fix: ensure `AI_PROVIDER` is set in the root `.env` and start from root.

### Two textareas

The assistant UI can have two textareas — the docked panel input and a floating quick-input. Use `.first()` when locating `textarea[placeholder*="Ask a question"]`.

### Textarea outside viewport

On some KB pages (especially CJK pages with different content lengths), the assistant panel's textarea may render partially outside the viewport. Playwright's default click actionability check fails with "element is outside of the viewport." Use `input.click({ force: true })` to bypass this check.

### GitFS cold start

The first GitFS request pays a clone penalty (varies by repo size). Subsequent requests use the persistent cache at `/tmp/gitfs-cache`. Discard the first run or do a warmup query before the timed runs.

### DeepSeek reasoning tokens

DeepSeek models emit `reasoning-delta` tokens before tool calls and before the final answer. These appear in the raw SSE stream but are NOT visible in the browser UI. The browser test measures DOM text, not SSE tokens, so it correctly excludes reasoning. The raw API test (`test-backend.mjs`) captures these as TTFT, which is why it ranks MCP faster — ignore that for real-world decisions.
