# TockDocs

## Overview

TockDocs is an AI-powered Knowledge Management System.

## Why TockDocs

TockDocs is built from the ground up to be **agent-friendly**. In independent audits using [AFDocs](https://github.com/afdocs/afdocs) - the standard for AI-agent documentation quality - the official TockDocs site scores **98/100 (Grade A)**:

- **Content discoverability 100/100** - every page declares an `llms.txt` directive in both HTML and raw markdown, so agents like Claude Code, Cursor, and Copilot can find and navigate all documentation automatically.
- **Markdown availability 100/100** - every page serves a clean `.md` variant and supports `Accept: text/markdown` content negotiation. No SPA shells, no auth gates.
- **Observability 98/100** - production-grade cache headers on all endpoints, 100% `llms.txt` → sitemap coverage, and 149 valid code fences across the entire site.
- **116 `llms.txt` links** across 4 documentation sets, all pointing to markdown - median page size 6K chars, well within agent context windows.

This isn't an afterthought - it's baked into the TockDocs Nuxt layer. Every site you build with TockDocs inherits these agent-friendly defaults out of the box.

## AI FS Backend

The built-in AI assistant retrieves documentation through one of three filesystem backends, controlled by `ASSISTANT_FS_BACKEND`. Each backend trades off speed, flexibility, and setup complexity differently.

### Speed Benchmark

Measured in a real browser (Chromium, Playwright, full Vue hydration) with DeepSeek `deepseek-v4-pro`, 3 runs per backend on both a Latin-alphabet KB (English) and a non-Latin KB (Chinese).

**Time to Answer Text** - Enter key → first substantive paragraph rendered:

| Backend | English KB | Chinese KB | Average  |
| ------- | ---------- | ---------- | -------- |
| INDEX   | 4,966ms    | 4,424ms    | 4,695ms  |
| MCP     | 7,695ms    | 8,592ms    | 8,144ms  |
| GitFS   | 12,642ms   | 13,860ms   | 13,251ms |

**Time to First Visual Feedback** - Enter key → tool indicator/source appearing:

| Backend | English KB | Chinese KB | Average |
| ------- | ---------- | ---------- | ------- |
| INDEX   | 1,621ms    | 4,420ms    | 3,021ms |
| MCP     | 1,491ms    | 4,673ms    | 3,082ms |
| GitFS   | 1,681ms    | 5,059ms    | 3,370ms |

### Test Flow

```text
INDEX:  |Enter|──1.6s──|sources appear|──3.3s──|ANSWER text|
                        └─ get-page ─┘   └─ LLM generates ─┘

MCP:    |Enter|──1.5s──|search result|──2.0s──|page fetched|──4.2s──|ANSWER text|
                        └ search-pages ┘       └─ get-page ─┘  └─ LLM ─┘

GitFS:  |Enter|──1.7s──|rg result|──bash──|cat result|──bash──|...──|ANSWER text|
                        └ 3-6 bash calls ──────────────────────────┘
```

**INDEX** injects a pre-generated page catalogue into the system prompt. The model picks the right page and calls `get-page` directly — one tool call, one round trip, then the answer.

**MCP** adds a search step (`search-pages` → `get-page`), which costs a second model round-trip.

**GitFS** gives the model raw filesystem access (`rg` / `cat` / `ls`), but the model explores iteratively across 3–8 bash calls before answering.

> INDEX falls back to MCP automatically if the index exceeds 8,000 tokens or can't be fetched. Fallback is logged as `"index_fallback"` with the reason.

### Choosing a Backend

Start with **INDEX** if your pages have `description` frontmatter and the generated index stays under 8,000 tokens. This is the fastest path: the model reads the page catalogue directly from the system prompt, picks the right page, and fetches it in a single tool call. No search round-trip, no filesystem exploration.

If the index is too large or your pages lack descriptions, fall back to **MCP**. It uses the built-in `search-pages` / `list-pages` / `get-page` tools to discover content. This adds a second model round-trip (search → fetch → answer) but works with any KB structure and requires no frontmatter.

Choose **GitFS** when the model needs to explore the raw filesystem — cross-file grep, multi-page pattern matching, or audit workflows that MCP's structured tools can't express. It's the most powerful but also the slowest, since the model runs multiple bash commands iteratively.
