---
name: scan
description: Tockdocs static analysis suite for unused code, duplication, circular dependencies, i18n coverage, and MDC integrity. Run after significant refactors, before releases, or when hunting dead code.
---

# Scan Tockdocs

Fast entrypoints:

```bash
pnpm run scan             # quick: lint + i18n + mdc + translation-parity + typecheck
pnpm run scan:deep        # full: above + knip + jscpd + depcruise
pnpm run precommit        # pre-commit gate: staged-mdc + i18n + lint + prepare
```

## What each check detects

| Command | Detects | Severity |
|---------|---------|----------|
| `pnpm run lint` | ESLint issues | 🔴 High |
| `pnpm run check:i18n` | Missing/dead translation keys, locale-aware config gaps | 🔴 High |
| `pnpm run check:mdc-source` | Malformed MDC in content files | 🔴 High |
| `pnpm run check:translation-parity` | Structural divergence between en/ and other locale folders (heading count, component order, code blocks, images) | 🔴 High |
| `pnpm run typecheck` | TypeScript errors | 🔴 High |
| `pnpm run check:content-integrity` | Rendered content consistency | 🔴 High |
| `pnpm run check:raw-html` | Raw HTML tags in content Markdown (breaks Nuxt Studio visual editor) | 🔴 High |
| `pnpm run knip` | Unused exports, files, dependencies, unlisted binaries | 🟡 Medium |
| `pnpm run jscpd:layer` | Duplicated code blocks (>50 tokens, >5 lines) | 🟢 Low |
| `pnpm run depcruise` | Circular dependencies, import graph violations | 🟡 Medium |

## Raw HTML in content

Nuxt Studio's TipTap visual editor cannot render raw HTML elements (`<img>`, `<table>`, `<br>`, `<div>`, `<sub>`, `<sup>`, etc.). Pages containing these tags show a blank editor pane. Always use Markdown equivalents:

| Raw HTML | Replace with |
|----------|-------------|
| `<img src="..." />` | `![alt](url)` |
| `<br>` / `<br/>` | blank line |
| `<table>` / `<tr>` / `<td>` | Markdown table or MDC component |
| `<sub>` / `<sup>` | MDC component or prose description |
| `<div>` / `<span>` / `<u>` | Markdown formatting |

The `check:raw-html` scanner catches these. HTML inside fenced code blocks is excluded (documentation examples are fine).

```bash
pnpm run check:raw-html
```

## Phase 1: Quick Scan (pre-commit level)

Already runs in `precommit`. Use for fast feedback before committing:

```bash
pnpm run precommit
```

## Phase 2: Unused Code & Duplication

```bash
pnpm run knip && pnpm run jscpd:layer
```

### knip expected noise

- `Unlisted binaries`: `pkg-pr-new` (CI only) and `tsx` (test runner) are expected
- `Unused exports`: Some composables/utils are exported for consumer apps even if unused in the layer itself
- `Unused files`: Generated `.nuxt` output and starter templates may be flagged — configure knip.json to exclude them

### jscpd expected noise

- `KnowledgeBaseSelect.vue` ↔ `LanguageSelect.vue`: intentional pattern sharing between selector components
- `app.vue` ↔ `error.vue`: both are Nuxt shell files with similar structure

## Phase 3: Circular Dependencies

```bash
pnpm run depcruise
```

Focus on the `layer/modules/` directory — Nuxt modules should not create circular import chains.

## Phase 4: Full Deep Scan

```bash
pnpm run scan:deep
```

Runs everything: knip → jscpd → depcruise → all quality checks.

## Fix commands

| Command | Fixes |
|---------|-------|
| `pnpm run lint:fix` | Auto-fixable ESLint issues |
| `pnpm run dedupe` | Deduplicate pnpm lockfile packages |

## When to run

- After renaming/moving components or composables
- After deleting or consolidating modules
- Before a release (`pnpm run verify` already covers quality gates)
- When hunting dead code after a refactor
- When Pi reports "unused export" or "duplicate code"
