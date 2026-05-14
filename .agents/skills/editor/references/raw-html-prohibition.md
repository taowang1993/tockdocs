# Raw HTML prohibition

**Rule**: Never write raw HTML tags inside TockDocs content Markdown files.

## Why

Nuxt Studio's TipTap visual editor cannot render raw HTML elements. When Studio opens a page containing `<img>`, `<table>`, `<br>`, `<div>`, `<sub>`, `<sup>`, or any other raw HTML tag, the left editor pane shows blank — the AST contains nodes TipTap has no extension for.

This was the root cause of [the chemistry KB Studio blank-editor bug](https://github.com/taowang1993/tockdocs/pull/...). The chemistry KB (60 pages) was ported from an external LaTeX-adjacent source and contained 216 `<img>` tags, 5 `<table>` blocks, and 15+ `<br>` tags — all of which broke Studio editing.

## What to use instead

| Raw HTML | Correct Markdown/MDC | Notes |
|----------|---------------------|-------|
| `<img src="url" />` | `![alt](url)` | Use `{style="..."}` for dimensions: `![alt](url){style="width:250px"}` |
| `<img src="url" style="zoom:50%"/>` | `![alt](url){style="zoom:50%"}` | MDC attribute syntax |
| `<br>` / `<br/>` | blank line | Use paragraph spacing instead |
| `<table>...</table>` | Markdown table (`\|...\|`) | For simple tables without colspan/rowspan |
| `<table>` with colspan/rowspan | MDC component | Complex tables need a custom component or manual layout |
| `<sub>` / `<sup>` | Describe in prose or use `$...$` math | `$\ce{H2O}$` renders subscript via chemistry notation |
| `<div class="...">` `<span class="...">` | Remove wrapper | Markdown paragraphs are fine without wrappers |
| `<u>` | `**bold**` or `*italic*` | Use semantic Markdown formatting |

## Allowed exceptions

- **`$...$` and `$$...$$` math** — NOT raw HTML. These are valid Markdown math delimiters processed by `remark-math`. They are fine in content.
- **HTML inside fenced code blocks** — Documentation examples are fine. The scanner excludes code fences.
- **`<NuxtImg>`, `<NuxtLink>`, etc.** — Vue/Nuxt components, not raw HTML. Use MDC or MDC component syntax for these.
- **`<kb>`, `<locale>`, `<boolean>`** — These are not HTML tags (they lack a letter after `<`). Fine.
- **`<https://...>`** — Autolinks, not HTML. Fine.

## How to catch violations

The `check:raw-html` scanner runs in `precommit` and `scan`:

```bash
# Scan all content
pnpm run check:raw-html

# Scan specific files
pnpm run check:raw-html docs/content/my-kb/en/page.md
```

If it finds raw HTML, it shows the file, line number, and the violating tag. It exits non-zero so CI/precommit blocks the commit.

## When porting content from external sources

External content (Google Docs exports, LaTeX conversions, academic notes) almost always contains raw HTML. After porting:

1. Run `pnpm run check:raw-html` immediately
2. Replace `<img>` with `![]()` — batch this with a script if there are many
3. Replace `<br>` with blank lines
4. For tables: convert simple ones to Markdown tables; for complex ones, create an MDC component or flatten to a list
5. Re-run the check to confirm all violations are resolved
