# TockDocs

## Overview

TockDocs is an AI-powered Knowledge Management System.

## Why TockDocs

TockDocs is built from the ground up to be **agent-friendly**. In independent audits using [AFDocs](https://github.com/afdocs/afdocs) — the standard for AI-agent documentation quality — the official TockDocs site scores **98/100 (Grade A)**:

- **Content discoverability 100/100** — every page declares an `llms.txt` directive in both HTML and raw markdown, so agents like Claude Code, Cursor, and Copilot can find and navigate all documentation automatically.
- **Markdown availability 100/100** — every page serves a clean `.md` variant and supports `Accept: text/markdown` content negotiation. No SPA shells, no auth gates.
- **Observability 98/100** — production-grade cache headers on all endpoints, 100% `llms.txt` → sitemap coverage, and 149 valid code fences across the entire site.
- **116 `llms.txt` links** across 4 documentation sets, all pointing to markdown — median page size 6K chars, well within agent context windows.

This isn't an afterthought — it's baked into the TockDocs Nuxt layer. Every site you build with TockDocs inherits these agent-friendly defaults out of the box.
